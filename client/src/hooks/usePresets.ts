import { useState, useEffect } from 'react'
import { VideoConfig, TextConfig, VideoStyle, TextEffect } from '../types'

export interface VideoPreset {
  id: string
  name: string
  isBuiltIn?: boolean
  resolution: { width: number; height: number }
  duration: number
  transition: 'fade' | 'fadeBlack' | 'none'
  transitionDuration: number
  text: Omit<TextConfig, 'content'>
  style: VideoStyle
  textEffect: TextEffect
  watermark: boolean
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  cinematicGrain: boolean
}

const STORAGE_KEY = 'oi_video_presets'

const BUILT_IN_PRESETS: VideoPreset[] = [
  {
    id: 'builtin-epic',
    name: 'Reels Épico',
    isBuiltIn: true,
    resolution: { width: 1080, height: 1920 },
    duration: 10,
    transition: 'fadeBlack',
    transitionDuration: 1.0,
    style: 'cinematic',
    textEffect: 'typewriter',
    watermark: true,
    watermarkPosition: 'top-right',
    cinematicGrain: true,
    text: {
      font: "'Bebas Neue', sans-serif",
      fontSize: 72,
      color: '#ffffff',
      position: { x: 50, y: 50 },
      align: 'center',
      shadow: true,
      maxWidth: 80,
      lineHeight: 1.2,
      fontWeight: 400,
      fontStyle: 'normal',
      highlightColor: '#FFD700',
      strokeColor: '#000000',
      strokeWidth: 0,
    },
  },
  {
    id: 'builtin-minimal',
    name: 'Minimalista',
    isBuiltIn: true,
    resolution: { width: 1080, height: 1920 },
    duration: 8,
    transition: 'fade',
    transitionDuration: 0.8,
    style: 'minimal',
    textEffect: 'fadeIn',
    watermark: false,
    watermarkPosition: 'top-right',
    cinematicGrain: false,
    text: {
      font: "'Inter', sans-serif",
      fontSize: 42,
      color: '#ffffff',
      position: { x: 50, y: 50 },
      align: 'center',
      shadow: false,
      maxWidth: 75,
      lineHeight: 1.5,
      fontWeight: 400,
      fontStyle: 'normal',
      highlightColor: '#E9D5A3',
      strokeColor: '#000000',
      strokeWidth: 0,
    },
  },
  {
    id: 'builtin-spiritual',
    name: 'Espiritualidad',
    isBuiltIn: true,
    resolution: { width: 1080, height: 1920 },
    duration: 12,
    transition: 'fadeBlack',
    transitionDuration: 1.5,
    style: 'serene',
    textEffect: 'slideUp',
    watermark: true,
    watermarkPosition: 'top-right',
    cinematicGrain: false,
    text: {
      font: "'Cinzel', serif",
      fontSize: 48,
      color: '#f5f0e8',
      position: { x: 50, y: 55 },
      align: 'center',
      shadow: true,
      maxWidth: 80,
      lineHeight: 1.6,
      fontWeight: 400,
      fontStyle: 'normal',
      highlightColor: '#E9D5A3',
      strokeColor: '#000000',
      strokeWidth: 0,
    },
  },
  {
    id: 'builtin-square',
    name: 'Post Cuadrado',
    isBuiltIn: true,
    resolution: { width: 1080, height: 1080 },
    duration: 8,
    transition: 'fadeBlack',
    transitionDuration: 0.8,
    style: 'bold',
    textEffect: 'scaleIn',
    watermark: true,
    watermarkPosition: 'bottom-right',
    cinematicGrain: false,
    text: {
      font: "'Montserrat', sans-serif",
      fontSize: 56,
      color: '#ffffff',
      position: { x: 50, y: 50 },
      align: 'center',
      shadow: true,
      maxWidth: 85,
      lineHeight: 1.3,
      fontWeight: 800,
      fontStyle: 'normal',
      highlightColor: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 4,
    },
  },
]

function extractPreset(config: VideoConfig, name: string): VideoPreset {
  const { content: _c, ...textWithoutContent } = config.text
  return {
    id: `user-${Date.now()}`,
    name: name.trim(),
    resolution: config.resolution,
    duration: config.duration,
    transition: config.transition,
    transitionDuration: config.transitionDuration,
    text: textWithoutContent,
    style: config.style,
    textEffect: config.textEffect,
    watermark: config.watermark ?? true,
    watermarkPosition: config.watermarkPosition ?? 'top-right',
    cinematicGrain: config.cinematicGrain ?? false,
  }
}

function presetToConfigPatch(preset: VideoPreset): Partial<VideoConfig> {
  return {
    resolution: preset.resolution,
    duration: preset.duration,
    transition: preset.transition,
    transitionDuration: preset.transitionDuration,
    style: preset.style,
    textEffect: preset.textEffect,
    watermark: preset.watermark,
    watermarkPosition: preset.watermarkPosition,
    cinematicGrain: preset.cinematicGrain,
  }
}

export function usePresets() {
  const [userPresets, setUserPresets] = useState<VideoPreset[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets))
    } catch {}
  }, [userPresets])

  const save = (config: VideoConfig, name: string) => {
    const preset = extractPreset(config, name)
    setUserPresets((prev) => [...prev, preset])
    return preset
  }

  const remove = (id: string) => {
    setUserPresets((prev) => prev.filter((p) => p.id !== id))
  }

  return {
    builtIn: BUILT_IN_PRESETS,
    userPresets,
    save,
    remove,
    getConfigPatch: presetToConfigPatch,
    getTextPatch: (preset: VideoPreset) => preset.text,
  }
}
