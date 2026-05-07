import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { exec, execFile } from 'child_process'
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

/**
 * Lista recursivamente todas las imágenes soportadas dentro de un directorio.
 * Retorna paths relativos al directorio base (e.g. 'pinterest/foto.jpg').
 */
function listImagesRecursive(baseDir: string, subDir = ''): string[] {
  const currentDir = subDir ? path.join(baseDir, subDir) : baseDir
  if (!fs.existsSync(currentDir)) return []

  const results: string[] = []
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const relativePath = subDir ? `${subDir}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...listImagesRecursive(baseDir, relativePath))
    } else if (SUPPORTED.includes(path.extname(entry.name).toLowerCase())) {
      results.push(relativePath)
    }
  }
  return results
}

// GET /api/images — listar imágenes del banco local (incluye subcarpetas)
router.get('/', (_req, res) => {
  try {
    const dir = config.paths.images
    if (!fs.existsSync(dir)) return res.json([])

    const files = listImagesRecursive(dir)

    const usage = loadUsage()
    const images: ImageItem[] = files.map((relativePath) => ({
      id: relativePath,
      filename: relativePath,
      path: path.join(dir, relativePath),
      url: `/api/images/file/${encodeURIComponent(relativePath)}`,
      usageCount: usage[relativePath] ?? 0,
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

    // Guardar en la subcarpeta 'unsplash' dentro del banco de imágenes
    const destDir = path.join(config.paths.images, 'unsplash')
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    const filename = `unsplash_${photoId}.jpg`
    const destPath = path.join(destDir, filename)
    const relativePath = `unsplash/${filename}`

    if (!fs.existsSync(destPath)) {
      const imgResp = await axios.get(url, { responseType: 'arraybuffer' })
      fs.writeFileSync(destPath, imgResp.data)
    }

    res.json({
      id: relativePath,
      filename: relativePath,
      path: destPath,
      url: `/api/images/file/${encodeURIComponent(relativePath)}`,
      photographer,
    } as ImageItem)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/images/gallery-dl — descargar tablero de Pinterest con gallery-dl y luego importar al banco
router.post('/gallery-dl', (req, res) => {
  const { url } = req.body ?? {}
  if (!url) return res.status(400).json({ error: 'url requerida' })

  // Validar que sea una URL HTTP(S) legítima
  try {
    const parsed = new URL(String(url))
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Solo URLs HTTP/HTTPS son aceptadas' })
    }
  } catch {
    return res.status(400).json({ error: 'URL inválida' })
  }

  // Descargar a subcarpeta pinterest/ dentro del banco de imágenes
  const destDir = path.join(config.paths.images, 'pinterest')
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  const bin = config.galleryDl.bin
  // execFile no usa shell, por lo que los argumentos son seguros contra inyección
  const args = ['-D', destDir, '--filename', '{filename}.{extension}', String(url)]

  execFile(bin, args, { timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
    if (err && !stdout) {
      const msg = stderr?.trim() || err.message
      if (msg.includes('command not found') || msg.includes('is not recognized') || msg.includes('no se reconoce')) {
        return res.status(503).json({
          error: `gallery-dl no encontrado en: ${bin}. Verifica GALLERY_DL_PATH en .env`,
        })
      }
      return res.status(500).json({ error: msg })
    }

    // Contar archivos descargados (líneas con "# " en stdout de gallery-dl)
    const lines = (stdout || '').split('\n').filter((l) => l.includes('# '))
    const downloaded = lines.length

    res.json({ downloaded, message: `${downloaded} imagen${downloaded !== 1 ? 'es' : ''} descargada${downloaded !== 1 ? 's' : ''} al banco` })
  })
})

// GET /api/images/file/:filename — servir imagen con content-type correcto
router.get('/file/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename)
  const filepath = path.resolve(config.paths.images, filename)

  // Prevenir path traversal: el archivo debe estar dentro del directorio de imágenes
  const safeBase = path.resolve(config.paths.images)
  if (!filepath.startsWith(safeBase + path.sep) && filepath !== safeBase) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }

  if (!fs.existsSync(filepath)) return res.status(404).end()

  const ext = path.extname(filename).toLowerCase()
  const mime = MIME_OVERRIDES[ext]
  if (mime) res.setHeader('Content-Type', mime)

  res.sendFile(filepath)
})

export default router
