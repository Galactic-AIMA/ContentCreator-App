import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Phrase, VideoRecord } from '../types'
import { config } from '../config'
import { generateMeta } from '../services/metaGenerator'
import { generateAIPhrases } from '../services/phraseAIGenerator'

const router = Router()

const SUPPORTED_IMG = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif']

/** Lista recursivamente todas las imágenes soportadas (retorna paths relativos). */
function listImagesRecursive(baseDir: string, subDir = ''): string[] {
  const currentDir = subDir ? path.join(baseDir, subDir) : baseDir
  if (!fs.existsSync(currentDir)) return []
  const results: string[] = []
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const relativePath = subDir ? `${subDir}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...listImagesRecursive(baseDir, relativePath))
    } else if (SUPPORTED_IMG.includes(path.extname(entry.name).toLowerCase())) {
      results.push(relativePath)
    }
  }
  return results
}

function loadPhrases(): Phrase[] {
  if (!fs.existsSync(config.paths.phrases)) return []
  return JSON.parse(fs.readFileSync(config.paths.phrases, 'utf-8'))
}

function savePhrases(phrases: Phrase[]) {
  fs.writeFileSync(config.paths.phrases, JSON.stringify(phrases, null, 2))
}

// GET /api/phrases
router.get('/', (_req, res) => {
  res.json(loadPhrases())
})

// GET /api/phrases/random
router.get('/random', (_req, res) => {
  const phrases = loadPhrases()
  if (!phrases.length) return res.status(404).json({ error: 'No phrases found' })
  const phrase = phrases[Math.floor(Math.random() * phrases.length)]
  res.json(phrase)
})

// GET /api/phrases/suggest?imageId=<opcional>
// Sugiere el par frase+imagen menos repetido, priorizando la categoría editorial
// con menos publicaciones en los últimos 30 días.
router.get('/suggest', (req, res) => {
  const { imageId } = req.query as { imageId?: string }

  const DB_PATH = path.join(__dirname, '../../../data/videos.json')
  const CATEGORIES = ['Sincronía Natural', 'Sabiduría del Cuerpo', 'Ritmo Vital'] as const
  type Category = typeof CATEGORIES[number]

  // 1. Construir Set de pares ya usados desde videos.json
  const videos: VideoRecord[] = fs.existsSync(DB_PATH)
    ? JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
    : []

  const usedPairs = new Set<string>()
  for (const v of videos) {
    if (v.phraseId && v.config?.imageId) {
      usedPairs.add(`${v.phraseId}:${v.config.imageId}`)
    }
  }

  // 2. Imágenes disponibles en el banco local (incluye subcarpetas)
  const imagesDir = config.paths.images
  const allImages: string[] = listImagesRecursive(imagesDir)

  // 3. Frases activas (tratar undefined status como 'active' para compatibilidad)
  const phrases = loadPhrases()
  const activePhrases = phrases.filter((p) => (p.status ?? 'active') === 'active')

  if (!activePhrases.length) return res.json({ exhausted: true })

  // 4. Contar publicaciones por categoría en los últimos 30 días
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const phraseById = new Map(activePhrases.map((p) => [p.id, p]))
  const categoryCounts: Record<Category, number> = {
    'Sincronía Natural': 0,
    'Sabiduría del Cuerpo': 0,
    'Ritmo Vital': 0,
  }

  for (const v of videos) {
    if (!v.createdAt || new Date(v.createdAt).getTime() <= thirtyDaysAgo) continue
    const phrase = v.phraseId ? phraseById.get(v.phraseId) : undefined
    if (phrase?.category && phrase.category in categoryCounts) {
      categoryCounts[phrase.category as Category]++
    }
  }

  // 5. Elegir la frase menos usada en la categoría con menos publicaciones recientes.
  //    Iterar categorías de menos a más publicadas; dentro de cada una, ordenar por usageCount ASC.
  //    Tomar la primera frase que todavía tenga al menos un par libre.
  const sortedCategories = [...CATEGORIES].sort((a, b) => categoryCounts[a] - categoryCounts[b])

  let chosenPhrase: Phrase | undefined

  for (const category of sortedCategories) {
    const candidates = activePhrases
      .filter((p) => p.category === category)
      .sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0))

    for (const candidate of candidates) {
      const usedWithThisPhrase = allImages.filter((img) => usedPairs.has(`${candidate.id}:${img}`))
      if (usedWithThisPhrase.length < allImages.length) {
        chosenPhrase = candidate
        break
      }
    }

    if (chosenPhrase) break
  }

  // Fallback: si todas las categorías están sin frases con categoría asignada,
  // buscar en todas las activas sin filtrar por categoría
  if (!chosenPhrase) {
    const allSorted = [...activePhrases].sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0))
    for (const candidate of allSorted) {
      const usedWithThisPhrase = allImages.filter((img) => usedPairs.has(`${candidate.id}:${img}`))
      if (usedWithThisPhrase.length < allImages.length) {
        chosenPhrase = candidate
        break
      }
    }
  }

  if (!chosenPhrase) return res.json({ exhausted: true })

  // 8. Calcular pares libres para la frase elegida
  const freeImages = allImages.filter((img) => !usedPairs.has(`${chosenPhrase!.id}:${img}`))
  const pairsRemaining = freeImages.length

  // 6. Si imageId viene en query: validar el par concreto
  if (imageId) {
    if (usedPairs.has(`${chosenPhrase.id}:${imageId}`)) {
      return res.status(409).json({
        error: 'Par ya utilizado',
        phrase: chosenPhrase,
        pairsRemaining,
      })
    }

    return res.json({
      phrase: chosenPhrase,
      imageId,
      imagePath: path.join(imagesDir, imageId),
      imageUrl: `/api/images/file/${encodeURIComponent(imageId)}`,
      category: chosenPhrase.category,
      pairsRemaining,
    })
  }

  // 7. Sin imageId: elegir imagen libre al azar entre las disponibles
  const randomImage = freeImages[Math.floor(Math.random() * freeImages.length)]

  return res.json({
    phrase: chosenPhrase,
    imageId: randomImage,
    imagePath: path.join(imagesDir, randomImage),
    imageUrl: `/api/images/file/${encodeURIComponent(randomImage)}`,
    category: chosenPhrase.category,
    pairsRemaining,
  })
})

// GET /api/phrases/check-pair?phraseId=X&imageId=Y
// Verifica si el par exacto ya fue usado en algún video generado.
router.get('/check-pair', (req, res) => {
  const { phraseId, imageId } = req.query as { phraseId?: string; imageId?: string }
  if (!phraseId || !imageId) return res.status(400).json({ error: 'phraseId and imageId required' })

  const DB_PATH = path.join(__dirname, '../../../data/videos.json')
  const videos: VideoRecord[] = fs.existsSync(DB_PATH)
    ? JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
    : []

  const used = videos.some((v) => v.phraseId === phraseId && v.config?.imageId === imageId)
  res.json({ used })
})

// POST /api/phrases
router.post('/', (req, res) => {
  const { text, category, author } = req.body
  if (!text) return res.status(400).json({ error: 'text is required' })

  const phrases = loadPhrases()
  const newPhrase: Phrase = { id: uuidv4(), text, category, author, usageCount: 0, status: 'active' }
  phrases.push(newPhrase)
  savePhrases(phrases)

  res.status(201).json(newPhrase)
})

// POST /api/phrases/bulk — importar múltiples frases a la vez (con categoría opcional)
router.post('/bulk', (req, res) => {
  const { texts, category } = req.body as { texts: string[]; category?: string }
  if (!Array.isArray(texts) || !texts.length)
    return res.status(400).json({ error: 'texts array is required' })

  const phrases = loadPhrases()
  const newPhrases: Phrase[] = texts
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((text) => ({ id: uuidv4(), text, category, usageCount: 0, status: 'active' as const }))

  phrases.push(...newPhrases)
  savePhrases(phrases)

  res.status(201).json(newPhrases)
})

// PUT /api/phrases/:id
router.put('/:id', (req, res) => {
  const phrases = loadPhrases()
  const idx = phrases.findIndex((p) => p.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Phrase not found' })

  phrases[idx] = { ...phrases[idx], ...req.body, id: req.params.id }
  savePhrases(phrases)

  res.json(phrases[idx])
})

// POST /api/phrases/generate-meta
router.post('/generate-meta', async (req, res) => {
  const { text } = req.body as { text: string }
  if (!text) return res.status(400).json({ error: 'text is required' })
  try {
    const meta = await generateMeta(text)
    res.json(meta)
  } catch (err: any) {
    console.error('generateMeta error:', err)
    res.status(500).json({ error: err.message || 'Failed to generate metadata' })
  }
})

// GET /api/phrases/pairs-stats — pares libres por frase (usa videos.json + banco de imágenes)
router.get('/pairs-stats', (_req, res) => {
  const DB_PATH = path.join(__dirname, '../../../data/videos.json')
  const SUPPORTED = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif']

  const videos: VideoRecord[] = fs.existsSync(DB_PATH)
    ? JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
    : []

  const imagesDir = config.paths.images
  const totalImages = fs.existsSync(imagesDir)
    ? fs.readdirSync(imagesDir).filter((f) => SUPPORTED.includes(path.extname(f).toLowerCase())).length
    : 0

  const usedByPhrase: Record<string, Set<string>> = {}
  for (const v of videos) {
    if (v.phraseId && v.config?.imageId) {
      if (!usedByPhrase[v.phraseId]) usedByPhrase[v.phraseId] = new Set()
      usedByPhrase[v.phraseId].add(v.config.imageId)
    }
  }

  const phrases = loadPhrases()
  const stats: Record<string, { pairsRemaining: number; totalImages: number }> = {}
  for (const p of phrases) {
    const used = usedByPhrase[p.id]?.size ?? 0
    stats[p.id] = { pairsRemaining: Math.max(0, totalImages - used), totalImages }
  }

  res.json({ stats, totalImages })
})

// POST /api/phrases/generate-ai — genera frases con Claude y las guarda como pending
router.post('/generate-ai', async (req, res) => {
  const { category, count = 8 } = req.body as { category: string; count?: number }
  if (!category) return res.status(400).json({ error: 'category is required' })

  try {
    const generated = await generateAIPhrases(
      category as 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital',
      Math.min(Math.max(count, 1), 20)
    )
    const phrases = loadPhrases()
    phrases.push(...generated)
    savePhrases(phrases)
    res.status(201).json(generated)
  } catch (err: any) {
    console.error('generate-ai error:', err)
    res.status(500).json({ error: err.message || 'Error generando frases' })
  }
})

// GET /api/phrases/suggest-batch?count=N
// Devuelve N pares únicos usando el mismo algoritmo de balanceo de /suggest, sin repetir combinaciones dentro del lote.
router.get('/suggest-batch', (req, res) => {
  const count = Math.min(Math.max(parseInt(req.query.count as string) || 5, 1), 20)

  const DB_PATH = path.join(__dirname, '../../../data/videos.json')
  const CATEGORIES = ['Sincronía Natural', 'Sabiduría del Cuerpo', 'Ritmo Vital'] as const
  type Category = typeof CATEGORIES[number]

  const videos: VideoRecord[] = fs.existsSync(DB_PATH)
    ? JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
    : []

  const usedPairs = new Set<string>()
  for (const v of videos) {
    if (v.phraseId && v.config?.imageId) usedPairs.add(`${v.phraseId}:${v.config.imageId}`)
  }

  // Imágenes disponibles (incluye subcarpetas como pinterest/)
  const imagesDir = config.paths.images
  const allImages: string[] = listImagesRecursive(imagesDir)

  const phrases = loadPhrases()
  const activePhrases = phrases.filter((p) => (p.status ?? 'active') === 'active')
  if (!activePhrases.length) return res.json([])

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const phraseById = new Map(activePhrases.map((p) => [p.id, p]))
  const categoryCounts: Record<Category, number> = {
    'Sincronía Natural': 0, 'Sabiduría del Cuerpo': 0, 'Ritmo Vital': 0,
  }
  for (const v of videos) {
    if (!v.createdAt || new Date(v.createdAt).getTime() <= thirtyDaysAgo) continue
    const phrase = v.phraseId ? phraseById.get(v.phraseId) : undefined
    if (phrase?.category && phrase.category in categoryCounts) {
      categoryCounts[phrase.category as Category]++
    }
  }

  const results: object[] = []

  // Shuffle inicial para romper empates entre frases con el mismo usageCount
  const shuffledPhrases = [...activePhrases].sort(() => Math.random() - 0.5)
  // Frases ya elegidas en este lote — se evitan en el primer paso
  const batchUsedPhraseIds = new Set<string>()

  for (let i = 0; i < count; i++) {
    const sortedCategories = [...CATEGORIES].sort((a, b) => categoryCounts[a] - categoryCounts[b])

    let chosenPhrase: (typeof activePhrases)[0] | undefined
    let chosenImage: string | undefined

    // Dos pasadas: primero frases no usadas en el lote, luego cualquiera (fallback)
    for (const requireUnused of [true, false]) {
      for (const category of sortedCategories) {
        const candidates = shuffledPhrases
          .filter((p) => p.category === category && (!requireUnused || !batchUsedPhraseIds.has(p.id)))
          .sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0))

        for (const candidate of candidates) {
          const freeImages = allImages.filter((img) => !usedPairs.has(`${candidate.id}:${img}`))
          if (freeImages.length > 0) {
            chosenPhrase = candidate
            chosenImage = freeImages[Math.floor(Math.random() * freeImages.length)]
            break
          }
        }
        if (chosenPhrase) break
      }

      if (!chosenPhrase) {
        const allCandidates = shuffledPhrases
          .filter((p) => !requireUnused || !batchUsedPhraseIds.has(p.id))
          .sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0))
        for (const candidate of allCandidates) {
          const freeImages = allImages.filter((img) => !usedPairs.has(`${candidate.id}:${img}`))
          if (freeImages.length > 0) {
            chosenPhrase = candidate
            chosenImage = freeImages[Math.floor(Math.random() * freeImages.length)]
            break
          }
        }
      }

      if (chosenPhrase) break
    }

    if (!chosenPhrase || !chosenImage) break

    batchUsedPhraseIds.add(chosenPhrase.id)
    usedPairs.add(`${chosenPhrase.id}:${chosenImage}`)
    if (chosenPhrase.category && chosenPhrase.category in categoryCounts) {
      categoryCounts[chosenPhrase.category as Category]++
    }

    const freeAfter = allImages.filter((img) => !usedPairs.has(`${chosenPhrase!.id}:${img}`))

    results.push({
      phrase: chosenPhrase,
      imageId: chosenImage,
      imagePath: path.join(imagesDir, chosenImage),
      imageUrl: `/api/images/file/${encodeURIComponent(chosenImage)}`,
      category: chosenPhrase.category,
      pairsRemaining: freeAfter.length,
    })
  }

  res.json(results)
})

// PATCH /api/phrases/approve — aprueba frases pending, descarta las marcadas para eliminar
router.patch('/approve', (req, res) => {
  const { approveIds, discardIds = [] } = req.body as { approveIds: string[]; discardIds?: string[] }
  if (!Array.isArray(approveIds)) return res.status(400).json({ error: 'approveIds array is required' })

  const toDiscard = new Set(discardIds)
  const toApprove = new Set(approveIds)

  let phrases = loadPhrases()
  phrases = phrases
    .filter((p) => !toDiscard.has(p.id))
    .map((p) => toApprove.has(p.id) ? { ...p, status: 'active' as const } : p)

  savePhrases(phrases)
  res.json({ approved: approveIds.length, discarded: discardIds.length })
})

// DELETE /api/phrases/:id
router.delete('/:id', (req, res) => {
  const phrases = loadPhrases()
  const filtered = phrases.filter((p) => p.id !== req.params.id)
  if (filtered.length === phrases.length)
    return res.status(404).json({ error: 'Phrase not found' })

  savePhrases(filtered)
  res.json({ success: true })
})

export default router
