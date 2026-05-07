import { useRef, useEffect, useCallback } from 'react'
import { VideoConfig, STYLE_CONFIGS } from '../../types'

interface Props {
  config: VideoConfig
}

/**
 * Preview premium del video sobre canvas HTML5.
 * Replica la composición: imagen + overlay por estilo + texto con highlight.
 * Espera a que las Google Fonts estén listas antes de pintar.
 */
export default function VideoPreview({ config }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = config.resolution.width
    const H = config.resolution.height
    canvas.width = W
    canvas.height = H

    // Fondo oscuro base
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, W, H)

    if (!config.imagePreviewUrl) {
      drawOverlay(ctx, config, W, H)
      drawText(ctx, config, W, H)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = config.imagePreviewUrl
    img.onload = () => {
      const scale = Math.max(W / img.width, H / img.height)
      const sw = img.width * scale
      const sh = img.height * scale
      const sx = (W - sw) / 2
      const sy = (H - sh) / 2

      ctx.drawImage(img, sx, sy, sw, sh)

      // Filtros de estilo
      if (config.style === 'raw') applyGrayscale(ctx, W, H)

      drawOverlay(ctx, config, W, H)
      drawText(ctx, config, W, H)

      // ── NUEVO: Previsualización de Logo y Grano ──
      if (config.watermark) {
        drawWatermark(ctx, config, W, H)
      }
      if (config.cinematicGrain) {
        drawGrain(ctx, W, H)
      }
    }
    img.onerror = () => {
      // Gradiente de fondo elegante cuando no hay imagen
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#1a1030')
      grad.addColorStop(0.5, '#0f0a1a')
      grad.addColorStop(1, '#0a0a0f')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      drawOverlay(ctx, config, W, H)
      drawText(ctx, config, W, H)
      if (config.watermark) drawWatermark(ctx, config, W, H)
      if (config.cinematicGrain) drawGrain(ctx, W, H)
    }
  }, [config])

  useEffect(() => {
    const fontName = config.text.font.replace(/'/g, '').split(',')[0].trim()
    const weight = config.text.fontWeight === 800 ? '800' : '400'
    const style = config.text.fontStyle === 'italic' ? 'italic' : 'normal'
    const fontStr = `${style} ${weight} 10px "${fontName}"`

    // Forzar al navegador a cargar la fuente si no está lista
    if (document.fonts) {
      document.fonts.load(fontStr).then(() => {
        draw()
      })
    }
  }, [config.text.font, config.text.fontWeight, config.text.fontStyle, draw])

  useEffect(() => {
    // Escuchar cambios generales
    draw()
  }, [draw])

  return (
    <div ref={containerRef} className="flex items-center justify-center w-full h-full relative group">
      {/* Glow detrás del canvas */}
      <div
        className="absolute inset-0 rounded-2xl opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-50 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.3) 0%, transparent 70%)',
        }}
      />
      <canvas
        ref={canvasRef}
        className="relative z-10"
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          aspectRatio: `${config.resolution.width}/${config.resolution.height}`,
          borderRadius: '16px',
          objectFit: 'contain',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          boxShadow: `
            0 0 0 1px rgba(139, 92, 246, 0.05),
            0 4px 30px rgba(0, 0, 0, 0.4),
            0 0 60px rgba(139, 92, 246, 0.08)
          `,
        }}
      />

      {/* Badge de estilo actual */}
      <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/10 uppercase tracking-wider">
        {config.style}
      </div>

      {/* Badge de resolución */}
      <div className="absolute bottom-3 left-3 z-20 bg-black/60 backdrop-blur-md text-spirit-muted text-[9px] px-2 py-0.5 rounded-full border border-white/5">
        {config.resolution.width}×{config.resolution.height}
      </div>
    </div>
  )
}

// ── Overlay según estilo ──
function drawOverlay(ctx: CanvasRenderingContext2D, config: VideoConfig, W: number, H: number) {
  const styleConfig = STYLE_CONFIGS[config.style]
  if (!styleConfig) return

  const { overlayType, overlayOpacity } = styleConfig

  switch (overlayType) {
    case 'gradient-bottom': {
      const grad = ctx.createLinearGradient(0, H, 0, H * 0.35)
      grad.addColorStop(0, `rgba(0,0,0,${overlayOpacity + 0.1})`)
      grad.addColorStop(0.6, `rgba(0,0,0,${overlayOpacity * 0.3})`)
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      break
    }
    case 'full': {
      ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`
      ctx.fillRect(0, 0, W, H)
      break
    }
    case 'gradient-radial': {
      const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.95)
      grad.addColorStop(0, 'transparent')
      grad.addColorStop(1, `rgba(0,0,0,${overlayOpacity})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      break
    }
    case 'letterbox': {
      const barH = H * 0.12
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, W, barH)
      ctx.fillRect(0, H - barH, W, barH)
      ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`
      ctx.fillRect(0, 0, W, H)
      break
    }
    case 'none':
    default:
      break
  }
}

// ── Grayscale ──
function applyGrayscale(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const imageData = ctx.getImageData(0, 0, W, H)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    data[i] = avg
    data[i + 1] = avg
    data[i + 2] = avg
  }
  ctx.putImageData(imageData, 0, 0)
}

// ── Parsear [brackets] ──
function parseTextSegments(text: string): { text: string; styled: boolean; color: string | null }[] {
  const parts = text.split(/(\[[^\]]+\]|\[[^\]]*$)/g)
  return parts
    .map((part) => {
      if (part.startsWith('[')) {
        const isClosed = part.endsWith(']')
        const rawContent = part.slice(1, isClosed ? -1 : undefined)
        const [content, customColor] = rawContent.split('|')
        return { text: content, styled: true, color: customColor || null }
      }
      return { text: part, styled: false, color: null }
    })
    .filter((p) => p.text.length > 0)
}

// ── Dibujar texto con tipografías Google Fonts ──
function drawText(ctx: CanvasRenderingContext2D, config: VideoConfig, W: number, H: number) {
  const { text, style } = config
  if (!text.content) return

  const styleConfig = STYLE_CONFIGS[style]
  const fontSize = text.fontSize

  // Construir la string de font para canvas — nombre limpio de la fuente
  const fontName = text.font.replace(/'/g, '').split(',')[0].trim()
  const weightStr = text.fontWeight === 800 ? '800' : '400'
  const styleStr = text.fontStyle === 'italic' ? 'italic ' : ''

  // Canvas font: "italic 800 42px Inter"
  ctx.font = `${styleStr}${weightStr} ${fontSize}px "${fontName}", sans-serif`
  ctx.textAlign = text.align
  ctx.textBaseline = 'middle'

  // Usar la misma lógica de wrapping que computeLayoutsFor (Editor.tsx)
  // para que el preview sea WYSIWYG con el renderizado FFmpeg
  const maxPx = (Math.min(text.maxWidth, 85) / 100) * W
  const x =
    text.align === 'center'
      ? W / 2
      : text.align === 'right'
      ? W - (W - (text.position.x / 100) * W)
      : (text.position.x / 100) * W
  const y = (text.position.y / 100) * H

  // Sombra multi-capa premium
  if (text.shadow && styleConfig) {
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 4
  }

  // Eliminar separador de fase // antes de renderizar en el preview
  const displayContent = text.content.replace(/\s*\/\/\s*/g, ' ')
  const segments = parseTextSegments(displayContent)
  const flatText = segments.map(s => s.text).join('')

  // Factor 1.15x: compensa la diferencia de métricas entre Canvas y FFmpeg drawtext.
  // Sin esto, el preview muestra menos líneas que el render final y el texto se corta.
  const measureSafe = (txt: string) => ctx.measureText(txt).width * 1.15

  // Wrap text (sincronizado con computeLayoutsFor)
  const words = flatText.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (measureSafe(test) > maxPx && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  const lineH = fontSize * text.lineHeight
  const totalH = lines.length * lineH
  const startY = y - totalH / 2 + lineH / 2

  const hasHighlights = segments.some(s => s.styled)

  if (!hasHighlights) {
    // Renderizado simple
    ctx.fillStyle = text.color
    if (text.strokeWidth > 0) {
      ctx.strokeStyle = text.strokeColor || '#000000'
      ctx.lineWidth = text.strokeWidth
      ctx.lineJoin = 'round'
    }
    lines.forEach((line, i) => {
      const lineY = startY + i * lineH
      if (text.strokeWidth > 0) {
        ctx.strokeText(line, x, lineY)
      }
      ctx.fillText(line, x, lineY)
    })
  } else {
    // Renderizado con highlights por carácter
    let charIndex = 0
    lines.forEach((line, lineIdx) => {
      const lineY = startY + lineIdx * lineH
      const lineWidth = ctx.measureText(line).width
      let drawX = text.align === 'center' ? x - lineWidth / 2 : text.align === 'right' ? x - lineWidth : x

      for (let i = 0; i < line.length; i++) {
        const globalCharIdx = charIndex + i
        const segment = getSegmentAtIndex(segments, globalCharIdx)

        if (segment && segment.styled) {
          ctx.fillStyle = segment.color || text.highlightColor
          // Peso extra para texto resaltado
          ctx.font = `${styleStr}800 ${fontSize}px "${fontName}", sans-serif`
        } else {
          ctx.fillStyle = text.color
          ctx.font = `${styleStr}${weightStr} ${fontSize}px "${fontName}", sans-serif`
        }

        if (text.strokeWidth > 0) {
          ctx.strokeStyle = text.strokeColor || '#000000'
          ctx.lineWidth = text.strokeWidth
          ctx.lineJoin = 'round'
        }

        const savedAlign = ctx.textAlign
        ctx.textAlign = 'left'
        if (text.strokeWidth > 0) {
          ctx.strokeText(line[i], drawX, lineY)
        }
        ctx.fillText(line[i], drawX, lineY)
        drawX += ctx.measureText(line[i]).width
        ctx.textAlign = savedAlign
      }

      charIndex += line.length
      if (lineIdx < lines.length - 1) charIndex += 1
    })
  }

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}

function getSegmentAtIndex(
  segments: { text: string; styled: boolean; color: string | null }[],
  globalIndex: number
): { text: string; styled: boolean; color: string | null } | null {
  let offset = 0
  for (const seg of segments) {
    if (globalIndex >= offset && globalIndex < offset + seg.text.length) return seg
    offset += seg.text.length
  }
  return null
}

// ── Cache del logo (se carga una sola vez) ──
let _cachedLogo: HTMLImageElement | null = null
let _logoLoadPromise: Promise<HTMLImageElement | null> | null = null

function getLogoImage(): Promise<HTMLImageElement | null> {
  if (_cachedLogo) return Promise.resolve(_cachedLogo)
  if (_logoLoadPromise) return _logoLoadPromise
  _logoLoadPromise = new Promise((resolve) => {
    const img = new Image()
    img.src = '/data/logo.png' // relativo — pasa por el proxy de Vite
    img.onload = () => { _cachedLogo = img; resolve(img) }
    img.onerror = () => resolve(null)
  })
  return _logoLoadPromise
}

// ── Dibujar Marca de Agua (Logo) ──
function drawWatermark(ctx: CanvasRenderingContext2D, config: VideoConfig, W: number, H: number) {
  getLogoImage().then((logo) => {
    if (!logo) return
    const margin = 40
    const logoW = 120
    const logoH = (logo.height / logo.width) * logoW

    let x = W - logoW - margin
    let y = margin

    if (config.watermarkPosition === 'top-left') {
      x = margin
      y = margin
    } else if (config.watermarkPosition === 'bottom-right') {
      x = W - logoW - margin
      y = H - logoH - margin
    } else if (config.watermarkPosition === 'bottom-left') {
      x = margin
      y = H - logoH - margin
    }

    ctx.globalAlpha = 0.6
    ctx.drawImage(logo, x, y, logoW, logoH)
    ctx.globalAlpha = 1.0
  })
}

// ── Simular Grano de Cine ──
function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save()
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 50000; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000'
    ctx.fillRect(x, y, 1.5, 1.5)
  }
  ctx.restore()
}
