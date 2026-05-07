import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { config } from '../config'
import { ImageItem } from '../types'

const IMAGES_USAGE_PATH = path.join(__dirname, '../../../data/images-usage.json')

function loadUsage(): Record<string, number> {
  if (!fs.existsSync(IMAGES_USAGE_PATH)) return {}
  return JSON.parse(fs.readFileSync(IMAGES_USAGE_PATH, 'utf-8'))
}

const router = Router()

const SUPPORTED = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif']

const MIME_OVERRIDES: Record<string, string> = {
  '.jfif': 'image/jpeg',
  '.tif':  'image/tiff',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
}

// GET /api/images — listar imágenes del banco local
router.get('/', (_req, res) => {
  try {
    const dir = config.paths.images
    if (!fs.existsSync(dir)) return res.json([])

    const files = fs.readdirSync(dir).filter((f) =>
      SUPPORTED.includes(path.extname(f).toLowerCase())
    )

    const usage = loadUsage()
    const images: ImageItem[] = files.map((filename) => ({
      id: filename,
      filename,
      path: path.join(dir, filename),
      url: `/api/images/file/${encodeURIComponent(filename)}`,
      usageCount: usage[filename] ?? 0,
    }))

    res.json(images)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/images/random — imagen aleatoria
router.get('/random', (_req, res) => {
  try {
    const dir = config.paths.images
    const files = fs.readdirSync(dir).filter((f) =>
      SUPPORTED.includes(path.extname(f).toLowerCase())
    )
    if (!files.length) return res.status(404).json({ error: 'No images found' })

    const filename = files[Math.floor(Math.random() * files.length)]
    res.json({
      id: filename,
      filename,
      path: path.join(dir, filename),
      url: `/api/images/file/${encodeURIComponent(filename)}`,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/images/bulk-import — importar imágenes desde carpeta local (gallery-dl, Pinterest, etc.)
router.post('/bulk-import', (req, res) => {
  const { folderPath } = req.body ?? {}
  if (!folderPath) return res.status(400).json({ error: 'folderPath requerido' })

  const src = String(folderPath).trim()
  if (!fs.existsSync(src)) return res.status(400).json({ error: `Carpeta no encontrada: ${src}` })

  const destDir = config.paths.images
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  const allFiles = fs.readdirSync(src).filter((f) =>
    SUPPORTED.includes(path.extname(f).toLowerCase())
  )

  let imported = 0
  let skipped = 0
  const importedFiles: string[] = []

  for (const file of allFiles) {
    const dest = path.join(destDir, file)
    if (fs.existsSync(dest)) { skipped++; continue }
    fs.copyFileSync(path.join(src, file), dest)
    imported++
    importedFiles.push(file)
  }

  res.json({ imported, skipped, total: allFiles.length, files: importedFiles })
})

// GET /api/images/unsplash/search — buscar fotos en Unsplash (proxy)
router.get('/unsplash/search', async (req, res) => {
  const key = config.unsplash.accessKey
  if (!key) return res.status(503).json({ error: 'UNSPLASH_ACCESS_KEY no configurada en .env' })

  const { query = 'nature', page = '1' } = req.query as Record<string, string>

  try {
    const { data } = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query, page, per_page: 20, orientation: 'portrait' },
      headers: { Authorization: `Client-ID ${key}` },
    })

    res.json((data.results as any[]).map((p) => ({
      id: p.id,
      thumb: p.urls.thumb,
      regular: p.urls.regular,
      description: p.description || p.alt_description || '',
      photographer: p.user.name,
      photographerUrl: p.user.links.html,
      color: p.color,
    })))
  } catch (err: any) {
    res.status(500).json({ error: err.response?.data?.errors?.[0] ?? err.message })
  }
})

// POST /api/images/unsplash/download — descargar foto de Unsplash al banco local
router.post('/unsplash/download', async (req, res) => {
  const key = config.unsplash.accessKey
  if (!key) return res.status(503).json({ error: 'UNSPLASH_ACCESS_KEY no configurada en .env' })

  const { photoId, url, photographer } = req.body ?? {}
  if (!photoId || !url) return res.status(400).json({ error: 'photoId y url requeridos' })

  try {
    // Requerido por Unsplash API guidelines: registrar la descarga
    await axios.get(`https://api.unsplash.com/photos/${photoId}/download`, {
      headers: { Authorization: `Client-ID ${key}` },
    })

    const destDir = config.paths.images
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    const filename = `unsplash_${photoId}.jpg`
    const destPath = path.join(destDir, filename)

    if (!fs.existsSync(destPath)) {
      const imgResp = await axios.get(url, { responseType: 'arraybuffer' })
      fs.writeFileSync(destPath, imgResp.data)
    }

    res.json({
      id: filename,
      filename,
      path: destPath,
      url: `/api/images/file/${encodeURIComponent(filename)}`,
      photographer,
    } as ImageItem)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/images/file/:filename — servir imagen con content-type correcto
router.get('/file/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename)
  const filepath = path.join(config.paths.images, filename)
  if (!fs.existsSync(filepath)) return res.status(404).end()

  const ext = path.extname(filename).toLowerCase()
  const mime = MIME_OVERRIDES[ext]
  if (mime) res.setHeader('Content-Type', mime)

  res.sendFile(filepath)
})

export default router
