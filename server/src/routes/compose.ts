import { Router } from 'express'
import { generateImage } from '../services/imageGenerator'
import { VideoConfig, SegmentLayout } from '../types'

const router = Router()

interface GenerateImageRequest {
  config: VideoConfig
  format: 'jpeg' | 'png'
  quality: number
  hookLayouts?: SegmentLayout[]
  hookLines?: string[]
  punchlineLayouts?: SegmentLayout[]
  punchlineLines?: string[]
}

interface ImageOutput {
  type: 'single' | 'combined' | 'hook' | 'punchline'
  label: string
  filename: string
  publicUrl: string
  localPath: string
}

// POST /api/compose/image — generar imagen estática con frase superpuesta
router.post('/image', async (req, res) => {
  try {
    const {
      config: cfg,
      format = 'jpeg',
      quality = 90,
      hookLayouts,
      punchlineLayouts,
    } = req.body as GenerateImageRequest

    if (!cfg || !cfg.imagePath) {
      return res.status(400).json({ error: 'config.imagePath es requerido' })
    }

    const hasSplit = !!(hookLayouts?.length && punchlineLayouts?.length)
    const ts = Date.now()
    const results: ImageOutput[] = []

    if (!hasSplit) {
      const allLayouts: SegmentLayout[] = cfg.segmentLayouts || []
      const result = await generateImage(cfg, allLayouts, `composed_${ts}`, format, quality)
      results.push({ type: 'single', label: 'Imagen completa', ...result })
    } else {
      // B — Combinada: gancho arriba + remate abajo
      const combinedLayouts = [...hookLayouts!, ...punchlineLayouts!]
      const combined = await generateImage(cfg, combinedLayouts, `combined_${ts}`, format, quality)
      results.push({ type: 'combined', label: 'Combinada', ...combined })

      // C1 — Solo Gancho
      const hook = await generateImage(cfg, hookLayouts!, `hook_${ts}`, format, quality)
      results.push({ type: 'hook', label: 'Solo Gancho', ...hook })

      // C2 — Solo Remate
      const punchline = await generateImage(cfg, punchlineLayouts!, `punchline_${ts}`, format, quality)
      results.push({ type: 'punchline', label: 'Solo Remate', ...punchline })
    }

    res.json({ success: true, images: results })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/compose/image-s3 — subir imagen a AWS S3
router.post('/image-s3', async (req, res) => {
  try {
    const { localPath, filename } = req.body as { localPath: string; filename: string }
    if (!localPath || !filename) {
      return res.status(400).json({ error: 'localPath y filename son requeridos' })
    }
    const { uploadImageToS3 } = await import('../services/s3Service')
    const s3Url = await uploadImageToS3(localPath, filename)
    res.json({ success: true, s3Url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/compose/image-drive — subir imagen a Google Drive
router.post('/image-drive', async (req, res) => {
  try {
    const { localPath, filename } = req.body as { localPath: string; filename: string }
    if (!localPath || !filename) {
      return res.status(400).json({ error: 'localPath y filename son requeridos' })
    }
    const { uploadToDrive } = await import('../services/driveService')
    const driveUrl = await uploadToDrive(localPath, filename)
    res.json({ success: true, driveUrl })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
