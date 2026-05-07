import path from 'path'
import fs from 'fs'
import { config } from '../config'

const WINDOWS_FONTS = 'C:/Windows/Fonts'

// Mapeo de fuentes Google Font CSS → archivos de sistema Windows como fallback
export const FONT_FALLBACKS: Record<string, string> = {
  // Nombres nuevos (formato Google Font CSS)
  'Inter':              `${WINDOWS_FONTS}/arial.ttf`,
  'Bebas Neue':         `${WINDOWS_FONTS}/impact.ttf`,
  'Cinzel':             `${WINDOWS_FONTS}/georgiab.ttf`,
  'Lora':               `${WINDOWS_FONTS}/georgia.ttf`,
  'Montserrat':         `${WINDOWS_FONTS}/arialbd.ttf`,
  'Oswald':             `${WINDOWS_FONTS}/arialbd.ttf`,
  'Outfit':             `${WINDOWS_FONTS}/calibri.ttf`,
  'Playfair Display':   `${WINDOWS_FONTS}/georgiab.ttf`,
  'Poppins':            `${WINDOWS_FONTS}/arial.ttf`,
  'PT Serif':           `${WINDOWS_FONTS}/times.ttf`,
  'Raleway':            `${WINDOWS_FONTS}/calibri.ttf`,
  'Roboto Slab':        `${WINDOWS_FONTS}/arialbd.ttf`,
  'Space Grotesk':      `${WINDOWS_FONTS}/consola.ttf`,
  // Nombres legacy (compatibilidad con configs antiguas)
  'Montserrat-Bold':       `${WINDOWS_FONTS}/arialbd.ttf`,
  'Montserrat-Regular':    `${WINDOWS_FONTS}/arial.ttf`,
  'Playfair-Bold':         `${WINDOWS_FONTS}/georgiab.ttf`,
  'Lato-Regular':          `${WINDOWS_FONTS}/calibri.ttf`,
  'Oswald-Bold':           `${WINDOWS_FONTS}/arialbd.ttf`,
  'RobotoCondensed-Bold':  `${WINDOWS_FONTS}/arialbd.ttf`,
}

/**
 * Resuelve el path de una fuente TTF para FFmpeg.
 * Primero busca en la carpeta local de fuentes, luego en los fallbacks del sistema.
 * El path resultante está escapado para FFmpeg en Windows.
 */
export function resolveFontPath(fontName: string): string {
  // Extraer nombre base si viene en formato CSS: "'Inter', sans-serif" → "Inter"
  const cleanName = fontName.replace(/'/g, '').split(',')[0].trim()
  const customFont = path.join(config.paths.fonts, `${cleanName}.ttf`)
  const resolved = fs.existsSync(customFont)
    ? customFont
    : (FONT_FALLBACKS[cleanName] || FONT_FALLBACKS[fontName] || `${WINDOWS_FONTS}/arial.ttf`)
  return resolved.replace(/\\/g, '/').replace(/^([A-Z]):/, '$1\\:')
}

/**
 * Escapa una línea de texto para el filtro drawtext de FFmpeg.
 */
export function escapeLine(text: string): string {
  return text.replace(/'/g, "''").replace(/:/g, '\\:')
}
