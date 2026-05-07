import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { VideoConfig, SegmentLayout } from '../types'
import { config } from '../config'
import { resolveFontPath, escapeLine } from '../utils/fonts'

// Mapea calidad 70-100% → FFmpeg q:v 10-2 (inverso: mayor calidad = menor q:v)
function jpegQualityToFfmpeg(quality: number): number {
  return Math.max(2, Math.round(10 - (quality - 70) * 8 / 30))
}

export interface ImageResult {
  filename: string
  localPath: string
  publicUrl: string
}

export async function generateImage(
  cfg: VideoConfig,
  layouts: SegmentLayout[],
  outputName: string,
  format: 'jpeg' | 'png',
  quality: number,
): Promise<ImageResult> {
  const outputDir = path.resolve(config.paths.outputImages)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const ext = format === 'jpeg' ? '.jpg' : '.png'
  const filename = `${outputName}${ext}`
  const outputPath = path.join(outputDir, filename)

  const { width, height } = cfg.resolution
  const { text } = cfg
  const fontPath = resolveFontPath(text.font)

  // Detectar líneas con un solo segmento para usar centrado nativo de FFmpeg (w-tw)/2
  const segsByLine = new Map<number, number>()
  for (const seg of layouts) {
    const y = Math.round(seg.y)
    segsByLine.set(y, (segsByLine.get(y) || 0) + 1)
  }

  const drawTextFilters = layouts
    .filter((seg) => seg.text.trim().length > 0)
    .map((segObj: any) => {
      const strokeOpts = text.strokeWidth > 0
        ? `:borderw=${text.strokeWidth}:bordercolor=${text.strokeColor.replace('#', '0x')}@1`
        : ''
      const shadowOpts = text.shadow && text.strokeWidth === 0
        ? ':shadowcolor=black@0.7:shadowx=2:shadowy=3'
        : ''

      let xExpr = `${Math.round(segObj.x)}`
      if (text.align === 'center' && segObj.lineW) {
        const segsOnLine = segsByLine.get(Math.round(segObj.y)) || 1
        if (segsOnLine === 1) {
          xExpr = '(w-tw)/2'
        } else {
          const offset = Math.round(segObj.x - (Math.round(width / 2) - Math.round(segObj.lineW / 2)))
          xExpr = `(w-${segObj.lineW})/2+${offset}`
        }
      }

      return (
        `drawtext=text='${escapeLine(segObj.text.trim())}':` +
        `fontfile='${fontPath}':` +
        `fontsize=${text.fontSize}:` +
        `fontcolor=${segObj.color.replace('#', '0x')}:` +
        `x=${xExpr}:y=${segObj.y}` +
        strokeOpts +
        shadowOpts
      )
    })

  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    ...drawTextFilters,
  ]

  let overlayPos = 'W-w-40:40'
  if (cfg.watermarkPosition === 'top-left') overlayPos = '40:40'
  if (cfg.watermarkPosition === 'bottom-right') overlayPos = 'W-w-40:H-h-40'
  if (cfg.watermarkPosition === 'bottom-left') overlayPos = '40:H-h-40'

  const filterScriptPath = path.join(outputDir, `img_filters_${Date.now()}.txt`)
  if (cfg.watermark) {
    fs.writeFileSync(filterScriptPath,
      `[0:v]${filters.join(',')}[bg];[1:v]scale=120:-1,format=rgba,colorchannelmixer=aa=0.6[wm];[bg][wm]overlay=${overlayPos}`
    )
  } else {
    fs.writeFileSync(filterScriptPath, `[0:v]${filters.join(',')}`)
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(cfg.imagePath)
      .inputOptions(['-loop 1', '-t 1'])

    if (cfg.watermark) {
      const logoPath = path.resolve(__dirname, '../../../data/logo.png')
      cmd.input(logoPath)
    }

    const safePath = filterScriptPath.replace(/\\/g, '/')
    cmd.inputOptions(['-filter_complex_script', safePath])

    const outputOptions = ['-vframes 1', '-pix_fmt yuvj420p']
    if (format === 'jpeg') {
      outputOptions.push(`-q:v ${jpegQualityToFfmpeg(quality)}`)
    }

    cmd
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('end', () => {
        try { fs.unlinkSync(filterScriptPath) } catch {}
        resolve({
          filename,
          localPath: outputPath,
          publicUrl: `${config.publicBaseUrl}/output-images/${filename}`,
        })
      })
      .on('error', (err) => reject(new Error(`FFmpeg image error: ${err.message}`)))
      .run()
  })
}
