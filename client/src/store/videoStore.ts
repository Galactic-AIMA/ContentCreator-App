import { create } from 'zustand'
import { VideoConfig, VideoMeta, TextConfig } from '../types'

const DEFAULT_TEXT: TextConfig = {
  content: 'Tu frase aquí...',
  font: "'Inter', sans-serif",
  fontSize: 42,
  color: '#ffffff',
  position: { x: 50, y: 50 },
  align: 'center',
  shadow: true,
  maxWidth: 85,
  lineHeight: 1.4,
  fontWeight: 400,
  fontStyle: 'normal',
  highlightColor: '#FFD700',
  strokeColor: '#000000',
  strokeWidth: 0,
}

const DEFAULT_CONFIG: VideoConfig = {
  imageId: '',
  imagePath: '',
  imagePreviewUrl: '',
  duration: 10,
  transition: 'fadeBlack',
  transitionDuration: 1.0,
  text: DEFAULT_TEXT,
  resolution: { width: 1080, height: 1920 },
  style: 'serene',
  textEffect: 'fadeIn',
  watermark: true,
  watermarkPosition: 'top-right',
  cinematicGrain: false,
}

const DEFAULT_META: VideoMeta = {
  title: '',
  description: '',
  tags: [],
}

interface VideoStore {
  config: VideoConfig
  meta: VideoMeta
  selectedPhraseId: string | null
  isGenerating: boolean
  mode: 'video' | 'image'
  imageFormat: 'jpeg' | 'png'
  imageQuality: number
  setConfig: (partial: Partial<VideoConfig>) => void
  setText: (partial: Partial<TextConfig>) => void
  setMeta: (partial: Partial<VideoMeta>) => void
  setSelectedPhraseId: (id: string | null) => void
  setGenerating: (v: boolean) => void
  setMode: (mode: 'video' | 'image') => void
  setImageExport: (format: 'jpeg' | 'png', quality: number) => void
  reset: () => void
}

export const useVideoStore = create<VideoStore>((set) => ({
  config: DEFAULT_CONFIG,
  meta: DEFAULT_META,
  selectedPhraseId: null,
  isGenerating: false,
  mode: 'video',
  imageFormat: 'jpeg',
  imageQuality: 90,
  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),
  setText: (partial) =>
    set((s) => ({ config: { ...s.config, text: { ...s.config.text, ...partial } } })),
  setMeta: (partial) =>
    set((s) => ({ meta: { ...s.meta, ...partial } })),
  setSelectedPhraseId: (id) => set({ selectedPhraseId: id }),
  setGenerating: (v) => set({ isGenerating: v }),
  setMode: (mode) => set({ mode }),
  setImageExport: (imageFormat, imageQuality) => set({ imageFormat, imageQuality }),
  reset: () => set({ config: DEFAULT_CONFIG, meta: DEFAULT_META, selectedPhraseId: null }),
}))
