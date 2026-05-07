import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { VideoConfig } from '../types'
import { config } from '../config'
import { FONT_FALLBACKS, resolveFontPath, escapeLine } from '../utils/fonts'

// Resolver la ruta de ffmpeg automáticamente (winget instala en AppData)
function findFfmpegPath(): string {
  // 1. Si está en PATH, usar directamente
  const { execSync } = require('child_process')
  try {
    const result = execSync('where ffmpeg', { encoding: 'utf-8' }).trim().split('\n')[0].trim()
    if (result && fs.existsSync(result)) return result
  } catch {}

  // 2. Buscar en la ruta típica de winget
  const wingetBase = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft/WinGet/Packages'
  )
  if (fs.existsSync(wingetBase)) {
    const dirs = fs.readdirSync(wingetBase).filter(d => d.startsWith('Gyan.FFmpeg'))
    for (const dir of dirs) {
      const binPath = path.join(wingetBase, dir)
      const ffmpegExe = findFileRecursive(binPath, 'ffmpeg.exe')
      if (ffmpegExe) return ffmpegExe
    }
  }

  return 'ffmpeg' // fallback al PATH
}

function findFileRecursive(dir: string, filename: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isFile() && entry.name === filename) return fullPath
      if (entry.isDirectory()) {
        const found = findFileRecursive(fullPath, filename)
        if (found) return found
      }
    }
  } catch {}
  return null
}

const ffmpegPath = findFfmpegPath()
console.log(`FFmpeg path: ${ffmpegPath}`)
ffmpeg.setFfmpegPath(ffmpegPath)

export interface GenerateResult {
  filename: string
  localPath: string
  publicUrl: string
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55
}

function wrapText(text: string, fontSize: number, maxPx: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (estimateTextWidth(test, fontSize) > maxPx && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function generateVideo(
  cfg: VideoConfig,
  outputName: string,
  onProgress?: (percent: number) => void
): Promise<{ filename: string; localPath: string; publicUrl: string }> {
  const outputDir = path.resolve(config.paths.output)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const filename = `${outputName}.mp4`
  const outputPath = path.join(outputDir, filename)

  const { width, height } = cfg.resolution
  const { text, transition, transitionDuration, duration, cinematicGrain } = cfg

  const hasSplit = text.content.includes('//')
  const splitTime = Math.min(3.5, duration / 2) // Momento de la revelación

  const maxW = Math.round((text.maxWidth / 100) * width)
  const centerY = Math.round((text.position.y / 100) * height)
  const fontPath = resolveFontPath(text.font)
  const lineH = Math.round(text.fontSize * text.lineHeight)

  // Usar las lineas pre-calculadas por el cliente (con canvas.measureText real).
  // Si no vienen, calcular con la estimacion local como fallback.
  const lines = (cfg.wrappedLines && cfg.wrappedLines.length > 0)
    ? cfg.wrappedLines
    : wrapText(text.content, text.fontSize, maxW)
  const totalH = lines.length * lineH
  const startY = Math.max(10, centerY - Math.round(totalH / 2))

  const xExpr = text.align === 'center'
    ? '(w-tw)/2'
    : text.align === 'right'
    ? `w-tw-${width - Math.round((text.position.x / 100) * width)}`
    : `${Math.round((text.position.x / 100) * width)}`

  // Quitar corchetes de sintaxis de highlight para FFmpeg (ya que drawtext no soporta multicolor nativo en la misma línea)
  const stripBrackets = (str: string) => str.replace(/\[([^|\]]+)(?:\|[^\]]+)?\]/g, '$1')

  let drawTextFilters: string[] = []

  if (cfg.segmentLayouts && cfg.segmentLayouts.length > 0) {
    const numSegments = cfg.segmentLayouts.length

    // Detectar líneas con un solo segmento para usar centrado nativo de FFmpeg (w-tw)/2
    const segsByLineGlobal = new Map<number, number>()
    for (const seg of cfg.segmentLayouts) {
      const y = Math.round(seg.y)
      segsByLineGlobal.set(y, (segsByLineGlobal.get(y) || 0) + 1)
    }

    if (cfg.textEffect === 'typewriter' && transitionDuration > 0) {
      // TYPEWRITER FLUIDO LETRA POR LETRA:
      // Para mantener el kerning perfecto y que el stroke no se rompa,
      // generamos sub-strings progresivos en el tiempo.
      const totalChars = cfg.segmentLayouts.reduce((sum, seg) => sum + seg.text.length, 0)
      let globalCharIndex = 0

      cfg.segmentLayouts.forEach((segObj) => {
        if (!segObj.text.trim() && segObj.text.length > 0) {
          globalCharIndex += segObj.text.length
          return
        }

        const strokeOpts = text.strokeWidth > 0
          ? `:borderw=${text.strokeWidth}:bordercolor=${text.strokeColor.replace('#', '0x')}@1`
          : ''
        const shadowOpts = text.shadow && text.strokeWidth === 0
          ? ':shadowcolor=black@0.7:shadowx=2:shadowy=3'
          : ''

        const typewriterDuration = Math.min(totalChars * 0.05, cfg.duration * 0.75)

        // Para líneas de un solo segmento con centrado, usar (w-tw)/2 nativo de FFmpeg
        const segsOnLine = segsByLineGlobal.get(Math.round(segObj.y)) || 1
        const twXExpr = (text.align === 'center' && segsOnLine === 1)
          ? '(w-tw)/2'
          : `${Math.round(segObj.x)}`

        for (let len = 1; len <= segObj.text.length; len++) {
          const subText = segObj.text.substring(0, len)
          // Se suma transitionDuration para que el texto aparezca DESPUÉS de la transición
          const startTime = transitionDuration + (globalCharIndex / totalChars) * typewriterDuration
          const endTime = transitionDuration + ((globalCharIndex + 1) / totalChars) * typewriterDuration

          // Si es el último caracter del segmento, se queda en pantalla para siempre
          const isLast = len === segObj.text.length
          const enableExpr = isLast
            ? `gte(t\\,${startTime})`
            : `gte(t\\,${startTime})*lt(t\\,${endTime})`

          drawTextFilters.push(
            `drawtext=text='${escapeLine(subText)}':` +
            `fontfile='${fontPath}':` +
            `fontsize=${text.fontSize}:` +
            `fontcolor=${segObj.color.replace('#', '0x')}:` +
            `enable='${enableExpr}':` +
            `x=${twXExpr}:y=${segObj.y}` +
            strokeOpts +
            shadowOpts
          )
          globalCharIndex++
        }
      })
    } else {
      // RESTO DE EFECTOS (Fade In, Slide Up, Scale In, None)
      // Dibujamos el segmento completo de una vez y animamos su alpha / posición

      // Detectar líneas con un solo segmento para usar centrado nativo de FFmpeg (w-tw)/2
      const segsByLine = new Map<number, number>()
      for (const seg of cfg.segmentLayouts) {
        const y = Math.round(seg.y)
        segsByLine.set(y, (segsByLine.get(y) || 0) + 1)
      }

      drawTextFilters = cfg.segmentLayouts.map((segObj, i) => {
        if (!segObj.text.trim() && segObj.text.length > 0) return ''

        const strokeOpts = text.strokeWidth > 0
          ? `:borderw=${text.strokeWidth}:bordercolor=${text.strokeColor.replace('#', '0x')}@1`
          : ''
        const shadowOpts = text.shadow && text.strokeWidth === 0
          ? ':shadowcolor=black@0.7:shadowx=2:shadowy=3'
          : ''

        // Por defecto, si el efecto es "none", que aparezca de golpe DESPUÉS de la transición
        let alphaExpr = transitionDuration > 0 ? `if(lt(t\\,${transitionDuration})\\,0\\,1)` : '1'
        let yExpr = `${segObj.y}`

        // Lógica de Fase (Split con //)
        if (hasSplit && segObj.phase) {
          if (segObj.phase === 2) {
             // El remate aparece después del split
             alphaExpr = `if(lt(t\\,${splitTime})\\,0\\,${alphaExpr})`
          } else {
             // El gancho desaparece después del split
             alphaExpr = `if(gt(t\\,${splitTime})\\,0\\,${alphaExpr})`
          }
        }

        if (cfg.textEffect !== 'none' && transitionDuration > 0) {
          const delay = transitionDuration;
          const animDur = 0.5; // El fade/slide dura 0.5 segundos
          if (cfg.textEffect === 'fadeIn' || cfg.textEffect === 'glowPulse' || cfg.textEffect === 'scaleIn') {
            alphaExpr = `if(lt(t\\,${delay})\\,0\\,if(lt(t\\,${delay + animDur})\\,(t-${delay})/${animDur}\\,1))`
          } else if (cfg.textEffect === 'slideUp') {
            alphaExpr = `if(lt(t\\,${delay})\\,0\\,if(lt(t\\,${delay + animDur})\\,(t-${delay})/${animDur}\\,1))`
            yExpr = `if(lt(t\\,${delay})\\,${segObj.y + 50}\\,if(lt(t\\,${delay + animDur})\\,${segObj.y} + 50 * (1 - (t-${delay})/${animDur})\\,${segObj.y}))`
          }
        }

        let finalXExpr = `${Math.round(segObj.x)}`

        if (text.align === 'center' && segObj.lineW) {
          const segsOnLine = segsByLine.get(Math.round(segObj.y)) || 1
          if (segsOnLine === 1) {
            // Línea de un solo segmento: FFmpeg mide tw con la fuente real → siempre perfecto
            finalXExpr = '(w-tw)/2'
          } else {
            // Múltiples segmentos (highlights): mantener cálculo relativo al canvas
            const centerBase = Math.round(width / 2) - Math.round(segObj.lineW / 2)
            const offset = Math.round(segObj.x - centerBase)
            finalXExpr = `(w-${segObj.lineW})/2+${offset}`
          }
        } else if (text.align === 'right' && segObj.lineW) {
          const rightBase = width - Math.round((text.position.x / 100) * width) - segObj.lineW
          const offset = Math.round(segObj.x - rightBase)
          finalXExpr = `(w-tw-${width - Math.round((text.position.x / 100) * width) - segObj.lineW})+${offset}`
        }

        return (
          `drawtext=text='${escapeLine(segObj.text.trim())}':` +
          `fontfile='${fontPath}':` +
          `fontsize=${text.fontSize}:` +
          `fontcolor=${segObj.color.replace('#', '0x')}:` +
          `alpha='${alphaExpr}':` +
          `x=${finalXExpr}:y=${yExpr}` +
          strokeOpts +
          shadowOpts
        )
      }).filter(f => f.length > 0)
    }
  } else {
    // MÉTODO ANTIGUO: Fallback por líneas (sin typewriter real ni colores múltiples)
    drawTextFilters = lines.map((rawLine, i) => {
      const line = stripBrackets(rawLine)
      const baseY = startY + i * lineH

      const strokeOpts = text.strokeWidth > 0
        ? `:borderw=${text.strokeWidth}:bordercolor=${text.strokeColor.replace('#', '0x')}@1`
        : ''

      const shadowOpts = text.shadow && text.strokeWidth === 0
        ? ':shadowcolor=black@0.7:shadowx=2:shadowy=3'
        : ''

      let alphaExpr = '1'
      let yExpr = `${baseY}`

      if (cfg.textEffect !== 'none' && transitionDuration > 0) {
        if (cfg.textEffect === 'fadeIn' || cfg.textEffect === 'glowPulse') {
          alphaExpr = `if(lt(t\\,${transitionDuration})\\,t/${transitionDuration}\\,1)`
        } else if (cfg.textEffect === 'slideUp') {
          alphaExpr = `if(lt(t\\,${transitionDuration})\\,t/${transitionDuration}\\,1)`
          yExpr = `if(lt(t\\,${transitionDuration})\\,${baseY} + 50 * (1 - t/${transitionDuration})\\,${baseY})`
        } else if (cfg.textEffect === 'typewriter' || cfg.textEffect === 'scaleIn') {
          alphaExpr = `if(lt(t\\,${transitionDuration})\\,t/${transitionDuration}\\,1)`
        }
      }

      return (
        `drawtext=text='${escapeLine(line)}':` +
        `fontfile='${fontPath}':` +
        `fontsize=${text.fontSize}:` +
        `fontcolor=${text.color.replace('#', '0x')}:` +
        `alpha='${alphaExpr}':` +
        `x=${xExpr}:y=${yExpr}` +
        strokeOpts +
        shadowOpts
      )
    })
  }

  const fadeColor = transition === 'fadeBlack' ? 'black' : 'white'
  
  const fadeIn = transition !== 'none'
    ? `,fade=t=in:st=0:d=${transitionDuration}:color=${fadeColor}`
    : ''
  const fadeOut = transition !== 'none'
    ? `,fade=t=out:st=${duration - transitionDuration}:d=${transitionDuration}:color=${fadeColor}`
    : ''

  // ── Construcción de la cadena de filtros ──
  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
  ]

  if (cinematicGrain) filters.push('noise=alls=8:allf=t+u')
  if (fadeIn) filters.push(fadeIn.substring(1)) // Quitar coma inicial si existe
  if (drawTextFilters.length > 0) filters.push(...drawTextFilters.filter(f => f))
  if (fadeOut) filters.push(fadeOut.substring(1))

  const vfilterStr = filters.join(',')
  console.log('Final Filter String:', vfilterStr)

  // Determinar posición del overlay (esquinas con margen de 40px — igual que el preview canvas)
  let overlayPos = 'W-w-40:40' // default top-right
  if (cfg.watermarkPosition === 'top-left') overlayPos = '40:40'
  if (cfg.watermarkPosition === 'bottom-right') overlayPos = 'W-w-40:H-h-40'
  if (cfg.watermarkPosition === 'bottom-left') overlayPos = '40:H-h-40'

  const filterScriptPath = path.join(outputDir, `filters_${Date.now()}.txt`)
  if (cfg.watermark) {
    // Aplicar el overlay ANTES de los fades para que el logo se desvanezca junto con el frame
    const preOverlayParts = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      ...(cinematicGrain ? ['noise=alls=8:allf=t+u'] : []),
    ]
    const postOverlayParts: string[] = []
    if (fadeIn) postOverlayParts.push(fadeIn.substring(1))
    postOverlayParts.push(...drawTextFilters.filter(f => f))
    if (fadeOut) postOverlayParts.push(fadeOut.substring(1))

    const preOverlay = preOverlayParts.join(',')
    const overlayAndPost = postOverlayParts.length > 0
      ? `overlay=${overlayPos},${postOverlayParts.join(',')}`
      : `overlay=${overlayPos}`

    fs.writeFileSync(filterScriptPath,
      `[0:v]${preOverlay}[base];[1:v]scale=120:-1,format=rgba,colorchannelmixer=aa=0.6[wm];[base][wm]${overlayAndPost}`)
  } else {
    fs.writeFileSync(filterScriptPath, `[0:v]${vfilterStr}`)
  }

  return new Promise((resolve, reject) => {
    const ffmpegCmd = ffmpeg(cfg.imagePath).inputOptions(['-loop 1', `-t ${duration}`])

    if (cfg.watermark) {
      const logoPath = path.resolve(__dirname, '../../../data/logo.png')
      ffmpegCmd.input(logoPath)
    }

    const safePath = filterScriptPath.replace(/\\/g, '/')
    ffmpegCmd.inputOptions(['-filter_complex_script', safePath])

    ffmpegCmd
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        `-t ${duration}`,
        '-r 30',
        '-an',
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        if (onProgress && progress.frames) {
          const totalFrames = duration * 30;
          let calculatedPercent = Math.round((progress.frames / totalFrames) * 100);
          calculatedPercent = Math.max(0, Math.min(100, calculatedPercent));
          onProgress(calculatedPercent);
        }
      })
      .on('end', () => {
        // Limpiar el script temporal
        try { fs.unlinkSync(filterScriptPath) } catch (e) {}
        resolve({
          filename,
          localPath: outputPath,
          publicUrl: `${config.publicBaseUrl}/output/${filename}`,
        })
      })
      .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      .run()
  })
}
