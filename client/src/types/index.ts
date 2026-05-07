// ── Estilos de video (inspirados en SpiritClips) ──
export type VideoStyle = 'serene' | 'raw' | 'minimal' | 'cinematic' | 'bold'
export type TextEffect = 'fadeIn' | 'typewriter' | 'slideUp' | 'scaleIn' | 'glowPulse' | 'none'
export type OverlayType = 'gradient-bottom' | 'full' | 'gradient-radial' | 'letterbox' | 'none'
export type TextPosition = 'center-top' | 'center' | 'center-bottom'

export interface StyleConfig {
  overlayType: OverlayType
  overlayOpacity: number
  textPosition: TextPosition
  textShadow: string
  extraStyles?: Record<string, string>
}

// Configuraciones visuales por estilo — overlay, sombra y posición
export const STYLE_CONFIGS: Record<VideoStyle, StyleConfig> = {
  serene: {
    overlayType: 'gradient-bottom',
    overlayOpacity: 0.4,
    textPosition: 'center-bottom',
    textShadow: '0 2px 20px rgba(0,0,0,0.5)',
  },
  raw: {
    overlayType: 'full',
    overlayOpacity: 0.3,
    textPosition: 'center',
    textShadow: '0 0 10px rgba(0,0,0,0.8)',
    extraStyles: { letterSpacing: '2px' },
  },
  minimal: {
    overlayType: 'none',
    overlayOpacity: 0,
    textPosition: 'center',
    textShadow: '0 2px 30px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.5)',
  },
  cinematic: {
    overlayType: 'letterbox',
    overlayOpacity: 0.5,
    textPosition: 'center',
    textShadow: '0 0 20px rgba(139,92,246,0.4), 0 2px 10px rgba(0,0,0,0.8)',
  },
  bold: {
    overlayType: 'gradient-radial',
    overlayOpacity: 0.4,
    textPosition: 'center-top',
    textShadow: '0 4px 8px rgba(0,0,0,0.6)',
    extraStyles: { letterSpacing: '4px' },
  },
}

// ── Configuración de texto ──
export interface TextConfig {
  content: string
  font: string
  fontSize: number
  color: string
  position: { x: number; y: number }
  align: 'left' | 'center' | 'right'
  shadow: boolean
  maxWidth: number
  lineHeight: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  highlightColor: string
  strokeColor: string
  strokeWidth: number
}

// ── Configuración general del video ──
export interface SegmentLayout {
  text: string
  x: number
  y: number
  color: string
  phase?: 1 | 2
}

export interface VideoConfig {
  imageId: string
  imagePath: string
  imagePreviewUrl: string
  duration: number
  transition: 'fade' | 'fadeBlack' | 'none'
  transitionDuration: number
  text: TextConfig
  resolution: { width: number; height: number }
  outputName?: string
  wrappedLines?: string[]
  segmentLayouts?: SegmentLayout[]
  style: VideoStyle
  textEffect: TextEffect
  watermark?: boolean
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  cinematicGrain?: boolean
}

export interface VideoMeta {
  title: string
  description: string
  tags: string[]
}

export interface Phrase {
  id: string
  text: string
  category?: string
  author?: string
  usageCount?: number
  status?: 'active' | 'pending'
}

export interface ImageItem {
  id: string
  filename: string
  path: string
  url: string
  usageCount?: number
}

export interface VideoRecord {
  id: string
  filename: string
  title: string
  description: string
  tags: string[]
  localPath: string
  publicUrl: string
  s3Url?: string
  driveUrl?: string
  createdAt: string
  config: VideoConfig
  phraseId?: string
  filesDeleted?: boolean
}

export type TransitionType = 'fade' | 'fadeBlack' | 'none'
export type TextAlign = 'left' | 'center' | 'right'
