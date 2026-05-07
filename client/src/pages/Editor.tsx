import { useState, useEffect, useRef } from 'react'
import { Wand2, Upload, Send, RotateCcw, HardDrive, Sparkles, AlertCircle, CheckCircle2, Trash2, Layers, XCircle, ChevronDown, FolderOpen } from 'lucide-react'
import VideoPreview from '../components/Preview/VideoPreview'
import VideoEditor from '../components/VideoEditor/VideoEditor'
import ImageBank from '../components/ImageBank/ImageBank'
import PhraseBank from '../components/PhraseBank/PhraseBank'
import ImageResult from '../components/ImageResult/ImageResult'
import ToastContainer from '../components/Toast/Toast'
import { useVideoStore } from '../store/videoStore'
import { videosApi, composerApi, phrasesApi, ComposedImageOutput, SuggestResult } from '../api'
import { VideoRecord, SegmentLayout, VideoConfig } from '../types'
import { usePresets } from '../hooks/usePresets'
import { useToast } from '../hooks/useToast'

type Tab = 'editor' | 'images' | 'phrases'

interface BatchItem {
  phraseText: string
  phraseId: string
  imageId: string
  imagePath: string
  imageUrl: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  jobId?: string
  result?: VideoRecord
  imageResults?: ComposedImageOutput[]
  error?: string
}

export default function Editor() {
  const {
    config, meta, selectedPhraseId, setMeta,
    isGenerating, setGenerating, reset,
    mode, setMode, imageFormat, imageQuality,
    setConfig, setText, setSelectedPhraseId,
  } = useVideoStore()

  const [tab, setTab] = useState<Tab>('editor')
  const [lastVideo, setLastVideo] = useState<VideoRecord | null>(null)
  const [lastImages, setLastImages] = useState<ComposedImageOutput[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number | null>(null)
  const { toasts, toast } = useToast()

  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestChip, setSuggestChip] = useState<{ category?: string; pairsRemaining: number } | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [pairStatus, setPairStatus] = useState<'free' | 'used' | null>(null)
  const pairCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cleanupPreview, setCleanupPreview] = useState<{ fileCount: number; sizeMB: number } | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupDone, setCleanupDone] = useState<{ deleted: number; freedMB: number } | null>(null)

  const [batchCount, setBatchCount] = useState(5)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchPresetId, setBatchPresetId] = useState<string | null>(null)
  const [metaOpen, setMetaOpen] = useState(false)

  const { builtIn: builtInPresets, userPresets, getConfigPatch, getTextPatch } = usePresets()

  const handleCleanupPreview = async () => {
    setCleanupLoading(true)
    setCleanupDone(null)
    try {
      const data = await videosApi.cleanup(true)
      setCleanupPreview({ fileCount: data.fileCount ?? 0, sizeMB: data.sizeMB ?? 0 })
    } catch {
      toast.error('Error consultando assets')
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleCleanupConfirm = async () => {
    setCleanupLoading(true)
    try {
      const data = await videosApi.cleanup(false)
      setCleanupPreview(null)
      setCleanupDone({ deleted: data.deleted ?? 0, freedMB: data.freedMB ?? 0 })
      setTimeout(() => setCleanupDone(null), 5000)
    } catch {
      toast.error('Error durante la limpieza')
    } finally {
      setCleanupLoading(false)
    }
  }

  // Validar el par frase+imagen en tiempo real cuando cambia cualquiera de los dos
  useEffect(() => {
    if (!selectedPhraseId || !config.imageId) { setPairStatus(null); return }
    if (pairCheckTimer.current) clearTimeout(pairCheckTimer.current)
    pairCheckTimer.current = setTimeout(async () => {
      try {
        const { used } = await phrasesApi.checkPair(selectedPhraseId, config.imageId)
        setPairStatus(used ? 'used' : 'free')
      } catch {
        setPairStatus(null)
      }
    }, 350)
    return () => { if (pairCheckTimer.current) clearTimeout(pairCheckTimer.current) }
  }, [selectedPhraseId, config.imageId])

  const handleSuggest = async () => {
    setSuggestLoading(true)
    setExhausted(false)
    setSuggestChip(null)
    setPairStatus(null)
    try {
      const result = await phrasesApi.suggest()
      if ('exhausted' in result) {
        setExhausted(true)
        return
      }
      const { phrase, imageId, imagePath, imageUrl, category, pairsRemaining } = result as SuggestResult
      setText({ content: phrase.text })
      setSelectedPhraseId(phrase.id)
      setConfig({ imageId, imagePath, imagePreviewUrl: imageUrl })
      setSuggestChip({ category, pairsRemaining })
      setPairStatus('free')
    } catch {
      toast.error('Error obteniendo sugerencia')
    } finally {
      setSuggestLoading(false)
    }
  }

  // ── Helper: calcula layouts de segmentos para un texto y posición Y dados ──
  const computeLayoutsFor = (textContent: string, yPercent: number, baseConfig?: VideoConfig) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const { text, resolution } = baseConfig ?? config
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
  const computeSegmentLayouts = (phraseText?: string, baseConfig?: VideoConfig) => {
    const content = phraseText ?? (baseConfig ?? config).text.content
    const activeConf = baseConfig ?? config
    const { wrappedLines, segmentLayouts: rawLayouts } = computeLayoutsFor(
      content,
      activeConf.text.position.y,
      baseConfig
    )

    const splitIndex = content.indexOf('//')
    const cleanSplitIndex = splitIndex !== -1
      ? content.substring(0, splitIndex).replace(/\[[^\]]+\]/g, (m) => m.slice(1, -1).split('|')[0]).length
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
  const computeImageLayouts = (phraseText?: string, baseConfig?: VideoConfig) => {
    const content = phraseText ?? (baseConfig ?? config).text.content
    const activeConf = baseConfig ?? config
    const hasSplit = content.includes('//')
    if (!hasSplit) {
      const { wrappedLines, segmentLayouts } = computeLayoutsFor(
        content,
        activeConf.text.position.y,
        baseConfig
      )
      return { hasSplit: false as const, wrappedLines, segmentLayouts }
    }

    const [ganchoRaw, remateRaw] = content.split('//')
    const hook = computeLayoutsFor(ganchoRaw.trim(), 35, baseConfig)
    const punchline = computeLayoutsFor(remateRaw.trim(), 70, baseConfig)

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

  // ── Generar en LOTE ──
  const pollJobUntilDone = (jobId: string): Promise<VideoRecord> =>
    new Promise((resolve, reject) => {
      const iv = setInterval(async () => {
        try {
          const s = await videosApi.getStatus(jobId)
          if (s.status === 'completed') { clearInterval(iv); resolve(s.result!) }
          else if (s.status === 'failed') { clearInterval(iv); reject(new Error(s.error || 'Job failed')) }
        } catch (err) { clearInterval(iv); reject(err) }
      }, 1200)
    })

  const handleBatchGenerate = async () => {
    setBatchRunning(true)
    setBatchItems([])
    setLastVideo(null)
    setLastImages(null)
    try {
      const pairs = await phrasesApi.suggestBatch(batchCount)
      if (!pairs.length) {
        toast.error('Sin combinaciones disponibles para el lote')
        return
      }

      // Aplicar preset seleccionado al config base del lote
      const allPresets = [...builtInPresets, ...userPresets]
      const selectedPreset = batchPresetId ? allPresets.find((p) => p.id === batchPresetId) : null
      const batchBaseConfig: VideoConfig = selectedPreset
        ? { ...config, ...getConfigPatch(selectedPreset), text: { ...config.text, ...getTextPatch(selectedPreset) } }
        : config

      const items: BatchItem[] = pairs.map((p) => ({
        phraseText: p.phrase.text,
        phraseId: p.phrase.id,
        imageId: p.imageId,
        imagePath: p.imagePath,
        imageUrl: p.imageUrl,
        status: 'pending' as const,
      }))
      setBatchItems([...items])

      for (let i = 0; i < items.length; i++) {
        items[i] = { ...items[i], status: 'processing' }
        setBatchItems([...items])

        try {
          if (mode === 'video') {
            const phraseText = items[i].phraseText
            const itemConfig = { ...batchBaseConfig, text: { ...batchBaseConfig.text, content: phraseText }, imageId: items[i].imageId, imagePath: items[i].imagePath }
            const { wrappedLines, segmentLayouts } = computeSegmentLayouts(phraseText, batchBaseConfig)
            const { jobId } = await videosApi.generate(
              { ...itemConfig, wrappedLines, segmentLayouts },
              { title: phraseText.split('//')[0].trim().slice(0, 60), description: '', tags: [] },
              items[i].phraseId
            )
            const result = await pollJobUntilDone(jobId)
            items[i] = { ...items[i], status: 'completed', jobId, result }
          } else {
            const phraseText = items[i].phraseText
            const itemConfig = { ...batchBaseConfig, text: { ...batchBaseConfig.text, content: phraseText }, imageId: items[i].imageId, imagePath: items[i].imagePath }
            const imageLayouts = computeImageLayouts(phraseText, batchBaseConfig)
            const params = imageLayouts.hasSplit
              ? { config: itemConfig, format: imageFormat, quality: imageQuality, hookLayouts: imageLayouts.hook.segmentLayouts as SegmentLayout[], hookLines: imageLayouts.hook.wrappedLines, punchlineLayouts: imageLayouts.punchline.segmentLayouts as SegmentLayout[], punchlineLines: imageLayouts.punchline.wrappedLines }
              : { config: { ...itemConfig, segmentLayouts: imageLayouts.segmentLayouts, wrappedLines: imageLayouts.wrappedLines }, format: imageFormat, quality: imageQuality }
            const { images } = await composerApi.generateImage(params)
            items[i] = { ...items[i], status: 'completed', imageResults: images }
          }
        } catch (err: any) {
          items[i] = { ...items[i], status: 'failed', error: err.message }
        }
        setBatchItems([...items])
      }
    } catch (err: any) {
      toast.error('Error en lote: ' + err.message)
    } finally {
      setBatchRunning(false)
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

          {/* ── Sugerir combinación nueva ── */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSuggest}
              disabled={suggestLoading || isGenerating}
              className="flex items-center justify-center gap-2 border border-spirit-accent/40 bg-spirit-accent/10 hover:bg-spirit-accent/20 disabled:opacity-50 disabled:cursor-not-allowed text-spirit-accent font-medium rounded-xl px-4 py-3 transition-all text-sm w-full"
            >
              <Sparkles size={14} className={suggestLoading ? 'animate-spin' : ''} />
              {suggestLoading ? 'Buscando...' : 'Sugerir combinación nueva'}
            </button>

            {suggestChip && !exhausted && (
              <div className="flex items-center justify-between text-xs px-3 py-2 bg-spirit-card border border-spirit-border rounded-lg">
                <span className="text-spirit-muted">{suggestChip.category ?? 'Sin categoría'}</span>
                <span className="text-spirit-accent font-semibold">{suggestChip.pairsRemaining} pares libres</span>
              </div>
            )}

            {pairStatus === 'used' && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
                <AlertCircle size={12} /> Esta combinación ya fue usada
              </div>
            )}

            {pairStatus === 'free' && (
              <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2">
                <CheckCircle2 size={12} /> Par disponible
              </div>
            )}

            {exhausted && (
              <div className="flex flex-col gap-2 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                <p className="text-xs text-amber-300 font-medium">Todas las combinaciones han sido usadas.</p>
                <button
                  onClick={() => setTab('phrases')}
                  className="text-xs text-amber-400 hover:text-amber-300 underline text-left transition-colors"
                >
                  Generar frases nuevas con IA →
                </button>
              </div>
            )}
          </div>

          {/* Botón principal */}
          <div className="flex gap-2 w-full">
            <button
              onClick={mode === 'video' ? generate : generateImage}
              disabled={isGenerating || batchRunning}
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

            <button
              onClick={() => videosApi.openOutput()}
              className="flex items-center justify-center bg-spirit-card border border-spirit-border hover:bg-spirit-border text-spirit-muted hover:text-white rounded-xl px-4 transition-colors shrink-0"
              title="Abrir carpeta output"
            >
              <FolderOpen size={16} />
            </button>
          </div>

          {/* ── Metadatos ── */}
          <div className="border-t border-spirit-border/30 pt-3">
            <button
              onClick={() => setMetaOpen((v) => !v)}
              className="flex items-center justify-between w-full text-xs text-spirit-muted hover:text-white transition-colors"
            >
              <span className="font-medium">Título · Descripción · Tags</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${metaOpen ? 'rotate-180' : ''}`} />
            </button>
            {metaOpen && (
              <div className="flex flex-col gap-2 mt-3">
                <input
                  className="bg-spirit-dark border border-spirit-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-spirit-accent transition-colors"
                  placeholder="Título"
                  value={meta.title}
                  onChange={(e) => setMeta({ title: e.target.value })}
                />
                <textarea
                  className="bg-spirit-dark border border-spirit-border rounded-lg p-2 text-xs text-white resize-none focus:outline-none focus:border-spirit-accent transition-colors"
                  rows={2}
                  placeholder="Descripción"
                  value={meta.description}
                  onChange={(e) => setMeta({ description: e.target.value })}
                />
                <input
                  className="bg-spirit-dark border border-spirit-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-spirit-accent transition-colors"
                  placeholder="Tags separados por coma"
                  value={meta.tags.join(', ')}
                  onChange={(e) =>
                    setMeta({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
                  }
                />
              </div>
            )}
          </div>

          {/* ── Generar en lote ── */}
          <div className="border-t border-spirit-border/30 pt-3">
            <button
              onClick={() => setBatchOpen((v) => !v)}
              className="flex items-center justify-between w-full text-xs text-spirit-muted hover:text-white transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Layers size={12} /> Generar en lote
              </span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${batchOpen ? 'rotate-180' : ''}`} />
            </button>

            {batchOpen && (
              <div className="flex flex-col gap-2 mt-3">
                {/* Selector de preset */}
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] uppercase tracking-widest text-spirit-muted font-semibold">Preset</p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setBatchPresetId(null)}
                      disabled={batchRunning}
                      className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                        batchPresetId === null
                          ? 'bg-spirit-accent text-white'
                          : 'bg-spirit-dark border border-spirit-border text-spirit-muted hover:text-white'
                      }`}
                    >
                      Auto
                    </button>
                    {[...builtInPresets, ...userPresets].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setBatchPresetId(preset.id)}
                        disabled={batchRunning}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                          batchPresetId === preset.id
                            ? 'bg-spirit-accent text-white'
                            : 'bg-spirit-dark border border-spirit-border text-spirit-muted hover:text-white'
                        }`}
                      >
                        {preset.name.length > 11 ? preset.name.slice(0, 9) + '…' : preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {([3, 5, 10] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setBatchCount(n)}
                      disabled={batchRunning}
                      className={`w-10 rounded-lg py-2 text-xs font-bold transition-colors ${
                        batchCount === n
                          ? 'bg-spirit-accent text-white'
                          : 'bg-spirit-dark border border-spirit-border text-spirit-muted hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={handleBatchGenerate}
                    disabled={batchRunning || isGenerating}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold bg-spirit-accent/20 border border-spirit-accent/40 text-spirit-accent hover:bg-spirit-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Layers size={12} className={batchRunning ? 'animate-spin' : ''} />
                    {batchRunning ? 'Generando...' : `Generar ×${batchCount}`}
                  </button>
                </div>

                {batchItems.length > 0 && (() => {
                  const done = batchItems.filter((it) => it.status === 'completed' || it.status === 'failed').length
                  const pct = Math.round((done / batchItems.length) * 100)
                  return (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs text-spirit-muted">
                        <span>{done}/{batchItems.length} completados</span>
                        <span className={done === batchItems.length ? 'text-green-400' : ''}>{pct}%</span>
                      </div>
                      <div className="h-1 bg-spirit-border rounded-full overflow-hidden">
                        <div className="h-full bg-spirit-accent transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto mt-0.5">
                        {batchItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-2.5 py-2 bg-spirit-dark border border-spirit-border/40 rounded-lg text-xs">
                            {item.status === 'completed' && <CheckCircle2 size={12} className="text-green-400 shrink-0" />}
                            {item.status === 'processing' && <Wand2 size={12} className="text-spirit-accent animate-spin shrink-0" />}
                            {item.status === 'pending' && <div className="w-3 h-3 rounded-full border border-spirit-border shrink-0" />}
                            {item.status === 'failed' && <XCircle size={12} className="text-red-400 shrink-0" />}
                            <span className="flex-1 text-spirit-muted truncate">
                              {item.phraseText.split('//')[0].trim().slice(0, 35)}
                            </span>
                            {item.status === 'completed' && mode === 'video' && item.result && (
                              <a href={item.result.publicUrl} target="_blank" rel="noreferrer" className="text-spirit-accent hover:text-white shrink-0 font-medium">↗</a>
                            )}
                            {item.status === 'completed' && mode === 'image' && item.imageResults?.[0] && (
                              <a href={item.imageResults[0].publicUrl} target="_blank" rel="noreferrer" className="text-spirit-accent hover:text-white shrink-0 font-medium">↗</a>
                            )}
                            {item.status === 'failed' && (
                              <span className="text-red-400/70 shrink-0 text-[10px]">Error</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
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

          {/* ── Limpieza de assets ── */}
          <div className="mt-auto pt-2 border-t border-spirit-border/50">
            {!cleanupPreview && !cleanupDone && (
              <button
                onClick={handleCleanupPreview}
                disabled={cleanupLoading}
                className="flex items-center justify-center gap-1.5 w-full text-xs text-gray-600 hover:text-gray-400 disabled:opacity-40 py-2 transition-colors"
              >
                <Trash2 size={11} />
                {cleanupLoading ? 'Consultando...' : 'Limpiar assets antiguos'}
              </button>
            )}

            {cleanupPreview && (
              <div className="flex flex-col gap-2 p-3 bg-spirit-card border border-spirit-border rounded-xl animate-fadeInUp">
                <p className="text-xs text-gray-300 font-medium">
                  Se liberarán <span className="text-white">{cleanupPreview.sizeMB} MB</span>
                  {' '}—{' '}
                  <span className="text-white">{cleanupPreview.fileCount} archivos</span> de más de 30 días
                </p>
                {cleanupPreview.fileCount === 0 ? (
                  <p className="text-xs text-gray-500">No hay archivos para limpiar.</p>
                ) : (
                  <p className="text-[10px] text-gray-500">
                    Los registros en videos.json se conservan (huella de pares intacta).
                  </p>
                )}
                <div className="flex gap-2">
                  {cleanupPreview.fileCount > 0 && (
                    <button
                      onClick={handleCleanupConfirm}
                      disabled={cleanupLoading}
                      className="flex-1 text-xs bg-red-800/60 hover:bg-red-700/70 disabled:opacity-50 text-red-200 rounded-lg px-3 py-1.5 font-medium transition-colors"
                    >
                      {cleanupLoading ? 'Limpiando...' : 'Confirmar limpieza'}
                    </button>
                  )}
                  <button
                    onClick={() => setCleanupPreview(null)}
                    className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {cleanupDone && (
              <p className="text-xs text-green-400 text-center py-2">
                ✓ {cleanupDone.deleted} archivos eliminados — {cleanupDone.freedMB} MB liberados
              </p>
            )}
          </div>
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  )
}
