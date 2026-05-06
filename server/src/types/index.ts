export type VideoStyle = 'serene' | 'raw' | 'minimal' | 'cinematic' | 'bold'
export type TextEffect = 'fadeIn' | 'typewriter' | 'slideUp' | 'scaleIn' | 'glowPulse' | 'none'

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

export interface SegmentLayout {
  text: string
  x: number
  y: number
  color: string
}

export interface VideoConfig {
  imageId: string
  imagePath: string
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
  phraseId?: string
  createdAt: string
  config: VideoConfig
  filesDeleted?: boolean
}

export interface Phrase {
  id: string
  text: string
  category?: 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital'
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

export interface WebhookPayload {
  videoUrl: string
  title: string
  description: string
  tags: string[]
  filename: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface GenerateVideoRequest {
  config: VideoConfig
  title: string
  description: string
  tags: string[]
  phraseId?: string
}
