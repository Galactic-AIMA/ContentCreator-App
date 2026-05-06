import { useState } from 'react'
import { Wand2, Upload, Send, RotateCcw, HardDrive } from 'lucide-react'
import VideoPreview from '../components/Preview/VideoPreview'
import VideoEditor from '../components/VideoEditor/VideoEditor'
import ImageBank from '../components/ImageBank/ImageBank'
import PhraseBank from '../components/PhraseBank/PhraseBank'
import ImageResult from '../components/ImageResult/ImageResult'
import ToastContainer from '../components/Toast/Toast'
import { useVideoStore } from '../store/videoStore'
import { videosApi, composerApi, ComposedImageOutput } from '../api'
import { VideoRecord, SegmentLayout } from '../types'
import { useToast } from '../hooks/useToast'

type Tab = 'editor' | 'images' | 'phrases'

export default function Editor() {
  const {
    config, meta, selectedPhraseId, setMeta,
    isGenerating, setGenerating, reset,
    mode, setMode, imageFormat, imageQuality,
  } = useVideoStore()

  const [tab, setTab] = useState<Tab>('editor')
  const [lastVideo, setLastVideo] = useState<VideoRecord | null>(null)
  const [lastImages, setLastImages] = useState<ComposedImageOutput[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number | null>(null)
  const { toasts, toast } = useToast()

  // ── Helper: calcula layouts de segmentos para un texto y posición Y dados ──
  const computeLayoutsFor = (textContent: string, yPercent: number) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const { text, resolution } = config
    const W = resolution.width
    const H = resolution.height

    const fontName = text.font.replace(/'/g, '').split(',')[0].trim()
    const weightStr = text.fontWeight === 800 ? '800' : '400'
    const styleStr = text.fontStyle === 'italic' ? 'italic ' : ''
    ctx.font = `${styleStr}${weightStr} ${text.fontSize}px "${fontName}", sans-serif`.trim()

    const maxPx = Math.round((Math.min(text.maxWidth, 85) / 100) * W)
    const x = Math.round((text.position.x / 100) * W)
    const y = Math.round((yPercent / 100) * H)

    const cleanContent = textContent.replace(/\s*\/\/\s*/g, ' ')
    const parts = cleanContent.split(/(\[[^\]]+\]|\[[^\]]*$)/g)
    const segments = parts.map((part) => {
      if (part.startsWith('[')) {
        const isClosed = part.endsWith(']')
        const rawContent = part.slice(1, isClosed ? -1 : undefined)
        const [content, customColor] = rawContent.split('|')
        return { text: content, styled: true, color: customColor || text.highlightColor }
      }
      return { text: part, styled: false, color: text.color }
    }).filter((p) => p.text.length > 0)

    const flatText = segments.map((s) => s.text).join('')
    const words = flatText.split(' ')
    const lines: string[] = []
    let current = ''
    const measureSafe = (txt: string) => ctx.measureText(txt).width * 1.15

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

    const lineH = text.fontSize * text.lineHeight
    const totalH = lines.length * lineH
    const startY = y - totalH / 2 + lineH / 2

    const segmentLayouts: any[] = []
    let charIndex = 0

    lines.forEach((line, lineIdx) => {
      const lineY = startY + lineIdx * lineH
      let totalLineWidth = 0
      const segmentsInLine: { text: string; color: string; isStyled: boolean }[] = []

      let lineOffset = 0
      while (lineOffset < line.length) {
        const globalCharIdx = charIndex + lineOffset
        let currentSegColor = text.color
        let currentIsStyled = false
        let segOffset = 0
        for (const seg of segments) {
          if (globalCharIdx >= segOffset && globalCharIdx < segOffset + seg.text.length) {
            currentSegColor = seg.color
            currentIsStyled = seg.styled
            break
          }
          segOffset += seg.text.length
        }

        let segLength = 0
        while (lineOffset + segLength < line.length) {
          const testGlobalIdx = globalCharIdx + segLength
          let nextSegColor = text.color
          let nextIsStyled = false
          let nextSegOffset = 0
          for (const seg of segments) {
            if (testGlobalIdx >= nextSegOffset && testGlobalIdx < nextSegOffset + seg.text.length) {
              nextSegColor = seg.color
              nextIsStyled = seg.styled
              break
            }
            nextSegOffset += seg.text.length
          }
          if (nextSegColor === currentSegColor && nextIsStyled === currentIsStyled) {
            segLength++
          } else {
            break
          }
        }

        const segmentText = line.substring(lineOffset, lineOffset + segLength)
        segmentsInLine.push({ text: segmentText, color: currentSegColor, isStyled: currentIsStyled })

        ctx.font = currentIsStyled
          ? `${styleStr}800 ${text.fontSize}px "${fontName}", sans-serif`
          : `${styleStr}${weightStr} ${text.fontSize}px "${fontName}", sans-serif`
        totalLineWidth += ctx.measureText(segmentText).width
        lineOffset += segLength
      }

      let drawX = text.align === 'center'
        ? x - Math.round(totalLineWidth / 2)
        : text.align === 'right'
        ? x - Math.round(totalLineWidth)
        : x

      for (const seg of segmentsInLine) {
        ctx.font = seg.isStyled
          ? `${styleStr}800 ${text.fontSize}px "${fontName}", sans-serif`
          : `${styleStr}${weightStr} ${text.fontSize}px "${fontName}", sans-serif`
        const segW = ctx.measureText(seg.text).width
        segmentLayouts.push({
          text: seg.text,
          x: drawX,
          y: lineY,
          color: seg.color,
          w: Math.round(segW),
          lineW: Math.round(totalLineWidth),
        })
        drawX += segW
      }

      charIndex += line.length
      if (lineIdx < lines.length - 1) charIndex += 1
    })

    return { wrappedLines: lines, segmentLayouts }
  }

  // ── Layouts para modo VIDEO (con fases gancho/remate y efectos de animación) ──
  const computeSegmentLayouts = () => {
    const { wrappedLines, segmentLayouts: rawLayouts } = computeLayoutsFor(
      config.text.content,
      config.text.position.y
    )

    const splitIndex = config.text.content.indexOf('//')
    const cleanSplitIndex = splitIndex !== -1
      ? config.text.content.substring(0, splitIndex).replace(/\[[^\]]+\]/g, (m) => m.slice(1, -1).split('|')[0]).length
      : -1

    let charCount = 0
    const segmentLayouts = rawLayouts.map((seg: any) => {
      const phase = (cleanSplitIndex !== -1 && charCount >= cleanSplitIndex) ? 2 : 1
      charCount += seg.text.length
      return { ...seg, phase }
    })

    return { wrappedLines, segmentLayouts }
  }

  // ── Layouts para modo IMAGEN (gancho a 35%, remate a 70%) ──
  const computeImageLayouts = () => {
    const hasSplit = config.text.content.includes('//')
    if (!hasSplit) {
      const { wrappedLines, segmentLayouts } = computeLayoutsFor(
        config.text.content,
        config.text.position.y
      )
      return { hasSplit: false as const, wrappedLines, segmentLayouts }
    }

    const [ganchoRaw, remateRaw] = config.text.content.split('//')
    const hook = computeLayoutsFor(ganchoRaw.trim(), 35)
    const punchline = computeLayoutsFor(remateRaw.trim(), 70)

    return {
      hasSplit: true as const,
      hook,
      punchline,
      combined: {
        wrappedLines: [...hook.wrappedLines, ...punchline.wrappedLines],
        segmentLayouts: [...hook.segmentLayouts, ...punchline.segmentLayouts],
      },
    }
  }

  // ── Generar VIDEO ──
  const generate = async () => {
    if (!config.imageId) {
      toast.error('Selecciona una imagen primero')
      return
    }
    setError(null)
    setGenerating(true)
    setRenderProgress(0)
    try {
      const { wrappedLines, segmentLayouts } = computeSegmentLayouts()
      const response = await videosApi.generate({ ...config, wrappedLines, segmentLayouts }, meta, selectedPhraseId ?? undefined)

      const poll = setInterval(async () => {
        try {
          const status = await videosApi.getStatus(response.jobId)
          if (status.status === 'completed') {
            clearInterval(poll)
            setLastVideo(status.result!)
            setGenerating(false)
            setRenderProgress(null)
          } else if (status.status === 'failed') {
            clearInterval(poll)
            toast.error(status.error || 'Error desconocido al generar el video')
            setGenerating(false)
            setRenderProgress(null)
          } else {
            setRenderProgress(Math.round(status.progress))
          }
        } catch {
          clearInterval(poll)
          toast.error('Error consultando estado al servidor')
          setGenerating(false)
          setRenderProgress(null)
        }
      }, 1000)
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
      setGenerating(false)
      setRenderProgress(null)
    }
  }

  // ── Generar IMAGEN ──
  const generateImage = async () => {
    if (!config.imageId) {
      toast.error('Selecciona una imagen primero')
      return
    }
    setError(null)
    setGenerating(true)
    setLastImages(null)
    try {
      const imageLayouts = computeImageLayouts()

      const params = imageLayouts.hasSplit
        ? {
            config,
            format: imageFormat,
            quality: imageQuality,
            hookLayouts: imageLayouts.hook.segmentLayouts as SegmentLayout[],
            hookLines: imageLayouts.hook.wrappedLines,
            punchlineLayouts: imageLayouts.punchline.segmentLayouts as SegmentLayout[],
            punchlineLines: imageLayouts.punchline.wrappedLines,
          }
        : {
            config: { ...config, segmentLayouts: imageLayouts.segmentLayouts, wrappedLines: imageLayouts.wrappedLines },
            format: imageFormat,
            quality: imageQuality,
          }

      const { images } = await composerApi.generateImage(params)
      setLastImages(images)
      toast.success('Imagen generada correctamente')
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message)
    } finally {
      setGenerating(false)
    }
  }

  const uploadToS3 = async () => {
    if (!lastVideo) return
    try {
      await videosApi.uploadToS3(lastVideo.id)
      toast.success('Subido a S3 correctamente')
    } catch (e: any) {
      toast.error('Error al subir a S3: ' + (e.response?.data?.error || e.message))
    }
  }

  const uploadToDrive = async () => {
    if (!lastVideo) return
    try {
      const { driveUrl } = await videosApi.uploadToDrive(lastVideo.id)
      setLastVideo({ ...lastVideo, driveUrl })
      toast.success('Subido a Google Drive correctamente')
    } catch (e: any) {
      toast.error('Error al subir a Drive: ' + (e.response?.data?.error || e.message))
    }
  }

  const publish = async (env: 'test' | 'prod') => {
    if (!lastVideo) return
    try {
      await videosApi.publish(lastVideo.id, env)
      toast.success(`Enviado al webhook de ${env}`)
    } catch (e: any) {
      toast.error('Error al publicar: ' + e.message)
    }
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'editor', label: 'Estilo', emoji: '🎨' },
    { id: 'images', label: 'Imágenes', emoji: '🖼️' },
    { id: 'phrases', label: 'Frases', emoji: '✍️' },
  ]

  return (
    <div className="flex h-screen bg-spirit-dark text-white overflow-hidden">
      {/* ── Panel izquierdo: controles ── */}
      <aside className="w-80 min-w-80 border-r border-spirit-border flex flex-col overflow-hidden bg-spirit-card">
        {/* Logo */}
        <div className="flex items-center justify-center py-6 border-b border-spirit-border bg-spirit-dark">
          <img src="/logo.png" alt="Organic Intelligence" className="h-10 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" />
        </div>

        {/* Toggle Video / Imagen */}
        <div className="flex mx-4 my-3 rounded-xl border border-spirit-border bg-spirit-dark overflow-hidden">
          <button
            onClick={() => { setMode('video'); setLastImages(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${
              mode === 'video' ? 'bg-spirit-accent text-white' : 'text-spirit-muted hover:text-white'
            }`}
          >
            🎬 Video
          </button>
          <button
            onClick={() => { setMode('image'); setLastVideo(null) }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${
              mode === 'image' ? 'bg-spirit-accent text-white' : 'text-spirit-muted hover:text-white'
            }`}
          >
            🖼️ Imagen
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-spirit-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium transition-all ${
                tab === t.id
                  ? 'text-white border-b-2 border-spirit-accent bg-spirit-accent/5'
                  : 'text-spirit-muted hover:text-spirit-text hover:bg-white/5'
              }`}
            >
              <span className="mr-1">{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'editor' && <VideoEditor />}
          {tab === 'images' && <ImageBank />}
          {tab === 'phrases' && <PhraseBank />}
        </div>

        {/* Meta datos */}
        <div className="border-t border-spirit-border p-4 flex flex-col gap-2 bg-spirit-dark/50">
          <input
            className="bg-spirit-dark border border-spirit-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-spirit-accent transition-colors"
            placeholder="Título del video"
            value={meta.title}
            onChange={(e) => setMeta({ title: e.target.value })}
          />
          <textarea
            className="bg-spirit-dark border border-spirit-border rounded-lg p-2 text-sm text-white resize-none focus:outline-none focus:border-spirit-accent transition-colors"
            rows={2}
            placeholder="Descripción"
            value={meta.description}
            onChange={(e) => setMeta({ description: e.target.value })}
          />
          <input
            className="bg-spirit-dark border border-spirit-border rounded-lg p-2 text-sm text-white focus:outline-none focus:border-spirit-accent transition-colors"
            placeholder="Tags separados por coma"
            value={meta.tags.join(', ')}
            onChange={(e) =>
              setMeta({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
            }
          />
        </div>
      </aside>

      {/* ── Centro: preview y acciones ── */}
      <main className="flex-1 flex flex-row items-center justify-center bg-spirit-dark p-6 gap-12">
        {/* Preview */}
        <div className="h-full max-h-[calc(100vh-100px)] relative" style={{ aspectRatio: `${config.resolution.width}/${config.resolution.height}` }}>
          <VideoPreview config={config} />
          {error && (
            <p className="absolute -bottom-8 left-0 w-full text-center text-red-400 text-sm animate-fadeInUp">{error}</p>
          )}
        </div>

        {/* Panel de acciones */}
        <div className="flex flex-col gap-4 w-72 shrink-0">
          {/* Botón principal */}
          <div className="flex gap-2 w-full">
            <button
              onClick={mode === 'video' ? generate : generateImage}
              disabled={isGenerating}
              className="flex-1 flex items-center justify-center gap-2 bg-spirit-accent hover:bg-spirit-accent-light disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3.5 transition-all glow-accent relative overflow-hidden text-sm"
            >
              <Wand2 size={16} className={isGenerating ? 'animate-spin' : ''} />
              {isGenerating
                ? mode === 'video' ? `${renderProgress ?? 0}%` : 'Generando...'
                : mode === 'video' ? 'Generar video' : 'Generar imagen'
              }
              {renderProgress !== null && mode === 'video' && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-white/50 transition-all duration-300"
                  style={{ width: `${renderProgress}%` }}
                />
              )}
            </button>

            <button
              onClick={reset}
              className="flex items-center justify-center bg-spirit-card border border-spirit-border hover:bg-spirit-border text-spirit-muted hover:text-white rounded-xl px-4 transition-colors shrink-0"
              title="Reiniciar configuraciones"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Resultado VIDEO */}
          {mode === 'video' && lastVideo && (
            <div className="w-full flex flex-col gap-3 p-4 bg-spirit-dark/50 border border-spirit-border rounded-xl animate-fadeInUp">
              <a
                href={lastVideo.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl px-4 py-3 transition-colors text-sm shadow-lg shadow-purple-900/20 w-full"
              >
                Ver en navegador ↗
              </a>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={uploadToS3}
                  className="flex items-center justify-center gap-1.5 bg-spirit-card hover:bg-spirit-border border border-spirit-border text-white rounded-lg px-2 py-2 transition-colors text-xs font-medium"
                >
                  <Upload size={13} /> S3
                </button>
                <button
                  onClick={uploadToDrive}
                  className="flex items-center justify-center gap-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 rounded-lg px-2 py-2 transition-colors text-xs font-medium"
                >
                  <HardDrive size={13} /> Drive
                </button>
                <button
                  onClick={() => publish('test')}
                  className="flex items-center justify-center gap-1.5 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-700/40 text-yellow-300 rounded-lg px-2 py-2 transition-colors text-xs font-medium"
                >
                  <Send size={13} /> Test n8n
                </button>
                <button
                  onClick={() => publish('prod')}
                  className="flex items-center justify-center gap-1.5 bg-green-900/30 hover:bg-green-900/50 border border-green-700/40 text-green-300 rounded-lg px-2 py-2 transition-colors text-xs font-medium"
                >
                  <Send size={13} /> Prod n8n
                </button>
              </div>
            </div>
          )}

          {/* Resultado IMÁGENES */}
          {mode === 'image' && lastImages && (
            <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
              <ImageResult
                images={lastImages}
                aspectRatio={`${config.resolution.width}/${config.resolution.height}`}
                onToast={(msg, type) => type === 'success' ? toast.success(msg) : toast.error(msg)}
              />
            </div>
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
