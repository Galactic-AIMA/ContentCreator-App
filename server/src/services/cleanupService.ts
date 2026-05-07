import fs from 'fs'
import path from 'path'
import { VideoRecord } from '../types'

const OUTPUT_DIR       = path.join(__dirname, '../../../output')
const OUTPUT_IMAGES_DIR = path.join(__dirname, '../../../output-images')
const DB_PATH          = path.join(__dirname, '../../../data/videos.json')

const MAX_AGE_MS   = 30 * 24 * 60 * 60 * 1000  // 30 días
const INTERVAL_MS  = 7  * 24 * 60 * 60 * 1000  // cada 7 días
const CLEANABLE    = new Set(['.mp4', '.jpg', '.jpeg', '.png', '.webp'])

// ── Helpers de JSON ──────────────────────────────────────────────────────────

function loadVideos(): VideoRecord[] {
  if (!fs.existsSync(DB_PATH)) return []
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

function saveVideos(videos: VideoRecord[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2))
}

// ── API pública ───────────────────────────────────────────────────────────────

export interface CleanupPreview {
  fileCount: number
  sizeMB: number
}

export interface CleanupResult {
  deleted: number
  freedMB: number
}

/** Calcula cuántos archivos y MB se liberarían sin borrar nada. */
export function cleanupPreview(): CleanupPreview {
  const now = Date.now()
  let fileCount = 0
  let totalBytes = 0

  for (const dir of [OUTPUT_DIR, OUTPUT_IMAGES_DIR]) {
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!CLEANABLE.has(path.extname(file).toLowerCase())) continue
      try {
        const stats = fs.statSync(path.join(dir, file))
        if (now - stats.mtimeMs > MAX_AGE_MS) {
          fileCount++
          totalBytes += stats.size
        }
      } catch { /* archivo inaccesible — ignorar */ }
    }
  }

  return { fileCount, sizeMB: Math.round((totalBytes / 1024 / 1024) * 10) / 10 }
}

/** Elimina archivos viejos y preserva la huella de pares en videos.json. */
export function runCleanup(): CleanupResult {
  const now = Date.now()
  let deleted = 0
  let freedBytes = 0
  const deletedPaths = new Set<string>()

  for (const dir of [OUTPUT_DIR, OUTPUT_IMAGES_DIR]) {
    if (!fs.existsSync(dir)) continue
    for (const file of fs.readdirSync(dir)) {
      if (!CLEANABLE.has(path.extname(file).toLowerCase())) continue
      const filePath = path.join(dir, file)
      try {
        const stats = fs.statSync(filePath)
        if (now - stats.mtimeMs > MAX_AGE_MS) {
          freedBytes += stats.size
          fs.unlinkSync(filePath)
          deletedPaths.add(filePath)
          deleted++
        }
      } catch { /* ignorar */ }
    }
  }

  // Actualizar videos.json: marcar filesDeleted, vaciar paths de disco,
  // pero conservar phraseId, imageId y createdAt (huella de pares intacta).
  if (deletedPaths.size > 0) {
    const videos = loadVideos()
    let changed = false
    for (const v of videos) {
      if (!v.filesDeleted && v.localPath && deletedPaths.has(v.localPath)) {
        v.filesDeleted = true
        v.localPath = ''
        v.publicUrl = ''
        changed = true
      }
    }
    if (changed) saveVideos(videos)
  }

  return { deleted, freedMB: Math.round((freedBytes / 1024 / 1024) * 10) / 10 }
}

// ── Servicio automático ───────────────────────────────────────────────────────

export function startCleanupService() {
  console.log('✅ Cleanup service: limpieza automática cada 7 días (archivos > 30 días)')
  runCleanupSilent()
  setInterval(runCleanupSilent, INTERVAL_MS)
}

function runCleanupSilent() {
  try {
    const result = runCleanup()
    if (result.deleted > 0) {
      console.log(`🧹 Cleanup: ${result.deleted} archivos eliminados, ${result.freedMB} MB liberados`)
    }
  } catch (err: any) {
    console.error('❌ Cleanup error:', err.message)
  }
}
