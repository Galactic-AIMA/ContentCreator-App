# Sistema de Frases y Pares Únicos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar gestión editorial de frases con sugerencia inteligente de pares frase+imagen, generación IA, aprobación por lote y limpieza de assets que preserva la memoria de pares.

**Architecture:** El par frase+imagen se rastrea derivándolo de `videos.json` (ya tiene `phraseId` + `config.imageId`). Un nuevo `pairService.ts` centraliza toda la lógica de pares y sugerencias. El servidor expone 4 endpoints nuevos. El cliente añade el botón "Generar combinación nueva" en el panel central y rediseña la pestaña Frases como panel de administración con 3 bloques.

**Tech Stack:** Express + TypeScript (servidor), React + Zustand (cliente), Gemini 2.0 Flash (generación IA), fs/json para persistencia.

---

## Estructura de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `server/src/types/index.ts` |
| Modificar | `client/src/types/index.ts` |
| Crear | `server/src/services/pairService.ts` |
| Crear | `server/src/services/phraseAiService.ts` |
| Modificar | `server/src/routes/phrases.ts` |
| Modificar | `server/src/routes/videos.ts` |
| Modificar | `server/src/services/cleanupService.ts` |
| Modificar | `client/src/api/index.ts` |
| Modificar | `client/src/components/PhraseBank/PhraseBank.tsx` |
| Modificar | `client/src/pages/Editor.tsx` |
| Modificar | `data/phrases.json` |

---

## Task 1: Actualizar tipos y migrar phrases.json

**Files:**
- Modify: `server/src/types/index.ts`
- Modify: `client/src/types/index.ts`
- Modify: `data/phrases.json`

- [ ] **Step 1: Actualizar Phrase en server/src/types/index.ts**

Reemplaza la interfaz `Phrase` y añade `filesDeleted` a `VideoRecord`:

```ts
export interface Phrase {
  id: string
  text: string
  category?: 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital'
  author?: string
  usageCount?: number
  status?: 'active' | 'pending'
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
```

- [ ] **Step 2: Actualizar Phrase en client/src/types/index.ts**

```ts
export interface Phrase {
  id: string
  text: string
  category?: string
  author?: string
  usageCount?: number
  status?: 'active' | 'pending'
}
```

- [ ] **Step 3: Migrar phrases.json — añadir status y usageCount a las 10 frases existentes**

Abre `data/phrases.json` y añade `"status": "active", "usageCount": 0` a cada objeto. El resultado debe quedar así (ejemplo de las primeras 2):

```json
[
  {
    "id": "io-1",
    "text": "Un abrazo de veinte segundos no es solo una muestra de cariño...",
    "category": "Sincronía Natural",
    "author": "Inteligencia Orgánica",
    "usageCount": 0,
    "status": "active"
  },
  {
    "id": "io-2",
    "text": "Llorar nunca ha sido una señal de debilidad...",
    "category": "Sabiduría del Cuerpo",
    "author": "Inteligencia Orgánica",
    "usageCount": 0,
    "status": "active"
  }
]
```

Aplicar los mismos campos a los 10 objetos existentes.

- [ ] **Step 4: Verificar que el servidor arranca sin errores**

```bash
cd server && npx tsx src/index.ts
```

Esperado: `Server running on http://localhost:3001`

- [ ] **Step 5: Commit**

```bash
git add server/src/types/index.ts client/src/types/index.ts data/phrases.json
git commit -m "feat: añadir status y filesDeleted a tipos Phrase y VideoRecord"
```

---

## Task 2: pairService.ts — Lógica de pares y sugerencia inteligente

**Files:**
- Create: `server/src/services/pairService.ts`

- [ ] **Step 1: Crear server/src/services/pairService.ts**

```ts
import fs from 'fs'
import path from 'path'
import { VideoRecord, Phrase } from '../types'
import { config } from '../config'

const DB_PATH = path.join(__dirname, '../../../data/videos.json')
const PHRASES_PATH = path.join(__dirname, '../../../data/phrases.json')
const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.avif']

type Category = 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital'
const CATEGORIES: Category[] = ['Sincronía Natural', 'Sabiduría del Cuerpo', 'Ritmo Vital']

function loadVideos(): VideoRecord[] {
  if (!fs.existsSync(DB_PATH)) return []
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

function loadPhrases(): Phrase[] {
  if (!fs.existsSync(PHRASES_PATH)) return []
  return JSON.parse(fs.readFileSync(PHRASES_PATH, 'utf-8'))
}

function getAvailableImages(): string[] {
  const dir = config.paths.images
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f =>
    SUPPORTED_EXTS.includes(path.extname(f).toLowerCase())
  )
}

export function getUsedPairs(): Set<string> {
  const pairs = new Set<string>()
  for (const v of loadVideos()) {
    if (v.phraseId && v.config?.imageId) {
      pairs.add(`${v.phraseId}:${v.config.imageId}`)
    }
  }
  return pairs
}

export function isPairUsed(phraseId: string, imageId: string): boolean {
  return getUsedPairs().has(`${phraseId}:${imageId}`)
}

function countCategoryPublications(videos: VideoRecord[], phrases: Phrase[]): Record<Category, number> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const phraseById = new Map(phrases.map(p => [p.id, p]))
  const counts: Record<Category, number> = {
    'Sincronía Natural': 0,
    'Sabiduría del Cuerpo': 0,
    'Ritmo Vital': 0,
  }
  for (const v of videos) {
    if (!v.phraseId || !v.createdAt) continue
    if (new Date(v.createdAt).getTime() < cutoff) continue
    const phrase = phraseById.get(v.phraseId)
    const cat = phrase?.category as Category | undefined
    if (cat && counts[cat] !== undefined) counts[cat]++
  }
  return counts
}

export interface SuggestResult {
  phrase: Phrase
  imageId: string
  imagePath: string
  imageUrl: string
  category: string
  pairsRemaining: number
}

export function suggestPair(requestedImageId?: string): SuggestResult | { exhausted: true } {
  const videos = loadVideos()
  const phrases = loadPhrases()
  const usedPairs = getUsedPairs()
  const availableImages = getAvailableImages()

  const activePhrases = phrases.filter(p => !p.status || p.status === 'active')
  const categoryCounts = countCategoryPublications(videos, activePhrases)

  const sortedCategories = [...CATEGORIES].sort(
    (a, b) => (categoryCounts[a] ?? 0) - (categoryCounts[b] ?? 0)
  )

  for (const category of sortedCategories) {
    const categoryPhrases = activePhrases
      .filter(p => p.category === category)
      .sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0))

    for (const phrase of categoryPhrases) {
      const freeImages = availableImages.filter(img => !usedPairs.has(`${phrase.id}:${img}`))
      if (freeImages.length === 0) continue

      if (requestedImageId) {
        if (usedPairs.has(`${phrase.id}:${requestedImageId}`)) continue
        return {
          phrase,
          imageId: requestedImageId,
          imagePath: path.join(config.paths.images, requestedImageId),
          imageUrl: `/api/images/file/${encodeURIComponent(requestedImageId)}`,
          category,
          pairsRemaining: freeImages.length,
        }
      }

      const selectedImage = freeImages[Math.floor(Math.random() * freeImages.length)]
      return {
        phrase,
        imageId: selectedImage,
        imagePath: path.join(config.paths.images, selectedImage),
        imageUrl: `/api/images/file/${encodeURIComponent(selectedImage)}`,
        category,
        pairsRemaining: freeImages.length - 1,
      }
    }
  }

  return { exhausted: true }
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
cd server && npx tsc --noEmit
```

Ignorar errores pre-existentes de `watermarkPosition`, `phase`, `lineW` (son conocidos). Solo verificar que `pairService.ts` no tiene errores propios.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/pairService.ts
git commit -m "feat: pairService — lógica de pares usados y sugerencia inteligente"
```

---

## Task 3: phraseAiService.ts — Generación de frases con IA

**Files:**
- Create: `server/src/services/phraseAiService.ts`

- [ ] **Step 1: Crear server/src/services/phraseAiService.ts**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

type Category = 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital'

const CATEGORY_HINTS: Record<Category, string> = {
  'Sincronía Natural': 'Conexión con la naturaleza, otros seres vivos, el entorno. Ejemplos: árboles, abrazos, sincronía con ciclos naturales.',
  'Sabiduría del Cuerpo': 'Señales que el cuerpo envía antes que la mente consciente. Ejemplos: intuición, llanto, dolor del rechazo social, sensaciones físicas de las emociones.',
  'Ritmo Vital': 'Ciclos naturales del organismo. Ejemplos: sueño, respiración, descanso, ritmos circadianos, recuperación celular.',
}

export async function generatePhrases(category: Category, count: number): Promise<string[]> {
  const prompt = `Eres el editor de contenido de "Inteligencia Orgánica", una marca que valida la experiencia humana a través de la biología.

Genera exactamente ${count} frases originales en la categoría "${category}".

Contexto de categoría: ${CATEGORY_HINTS[category]}

Reglas estrictas de cada frase:
1. Estructura obligatoria: GANCHO // REMATE (separados exactamente por " // ")
2. GANCHO: identifica una experiencia que el lector ya ha sentido pero nunca entendió
3. REMATE: explica el mecanismo biológico real y concreto (nombra hormona, nervio, zona cerebral, etc.) + afirmación corta que devuelve poder al lector
4. Tono: cálido, directo, empático — nunca moralizador ni predicador
5. Máximo 200 palabras por frase
6. El mecanismo biológico debe ser específico y real, nunca vago
7. Terminar siempre con una frase corta que empodera ("Escúchala siempre", "Tú tienes el mando", "Estás a punto de evolucionar", etc.)

Responde ÚNICAMENTE con un JSON array de strings sin markdown:
["gancho uno // remate uno", "gancho dos // remate dos", ...]`

  let result
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      result = await model.generateContent(prompt)
      break
    } catch (err: any) {
      if (attempt < 2 && err.message?.includes('429')) {
        await new Promise(r => setTimeout(r, 5000))
      } else {
        throw err
      }
    }
  }

  const text = result!.response.text().trim().replace(/^```json\s*|```$/g, '')

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed
        .filter(s => typeof s === 'string' && s.includes('//'))
        .slice(0, count)
    }
    return []
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/phraseAiService.ts
git commit -m "feat: phraseAiService — generación de frases con Gemini estilo Inteligencia Orgánica"
```

---

## Task 4: Endpoints del servidor — suggest, check-pair, generate-ai, approve

**Files:**
- Modify: `server/src/routes/phrases.ts`

- [ ] **Step 1: Reemplazar server/src/routes/phrases.ts completo**

```ts
import { Router } from 'express'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { Phrase } from '../types'
import { config } from '../config'
import { generateMeta } from '../services/metaGenerator'
import { suggestPair, isPairUsed } from '../services/pairService'
import { generatePhrases } from '../services/phraseAiService'

const router = Router()

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
  const phrases = loadPhrases().filter(p => !p.status || p.status === 'active')
  if (!phrases.length) return res.status(404).json({ error: 'No phrases found' })
  res.json(phrases[Math.floor(Math.random() * phrases.length)])
})

// GET /api/phrases/suggest?imageId=optional
// Sugiere el mejor par frase+imagen según categoría menos publicada y frase menos usada
router.get('/suggest', (req, res) => {
  try {
    const { imageId } = req.query as { imageId?: string }
    const result = suggestPair(imageId)
    if ('exhausted' in result) {
      return res.json({ exhausted: true })
    }
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/phrases/check-pair?phraseId=X&imageId=Y
// Valida si un par específico ya fue usado
router.get('/check-pair', (req, res) => {
  const { phraseId, imageId } = req.query as { phraseId?: string; imageId?: string }
  if (!phraseId || !imageId) {
    return res.status(400).json({ error: 'phraseId e imageId son requeridos' })
  }
  res.json({ used: isPairUsed(phraseId, imageId) })
})

// POST /api/phrases/generate-ai
// Genera frases con IA en estado pending
router.post('/generate-ai', async (req, res) => {
  try {
    const { category, count = 5 } = req.body as {
      category: 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital'
      count?: number
    }
    if (!category) return res.status(400).json({ error: 'category es requerido' })

    const texts = await generatePhrases(category, Math.min(count, 15))
    const phrases = loadPhrases()

    const newPhrases: Phrase[] = texts.map(text => ({
      id: uuidv4(),
      text,
      category,
      author: 'Inteligencia Orgánica',
      usageCount: 0,
      status: 'pending' as const,
    }))

    phrases.push(...newPhrases)
    savePhrases(phrases)

    res.json({ generated: newPhrases })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/phrases/approve
// Aprueba frases pendientes: las marcadas pasan a active, las no enviadas se eliminan
router.patch('/approve', (req, res) => {
  const { ids } = req.body as { ids: string[] }
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids debe ser un array' })

  const phrases = loadPhrases()
  const approvedSet = new Set(ids)

  const updated = phrases
    .filter(p => p.status !== 'pending' || approvedSet.has(p.id))
    .map(p => p.status === 'pending' && approvedSet.has(p.id)
      ? { ...p, status: 'active' as const }
      : p
    )

  savePhrases(updated)
  res.json({ approved: ids.length, discarded: phrases.filter(p => p.status === 'pending').length - ids.length })
})

// POST /api/phrases — crear una frase
router.post('/', (req, res) => {
  const { text, category, author } = req.body
  if (!text) return res.status(400).json({ error: 'text is required' })

  const phrases = loadPhrases()
  const newPhrase: Phrase = {
    id: uuidv4(),
    text,
    category,
    author,
    usageCount: 0,
    status: 'active',
  }
  phrases.push(newPhrase)
  savePhrases(phrases)
  res.status(201).json(newPhrase)
})

// POST /api/phrases/bulk — importar múltiples frases
router.post('/bulk', (req, res) => {
  const { texts, category } = req.body as { texts: string[]; category?: string }
  if (!Array.isArray(texts) || !texts.length)
    return res.status(400).json({ error: 'texts array is required' })

  const phrases = loadPhrases()
  const newPhrases: Phrase[] = texts
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(text => ({
      id: uuidv4(),
      text,
      category: category as any,
      author: 'Inteligencia Orgánica',
      usageCount: 0,
      status: 'active' as const,
    }))

  phrases.push(...newPhrases)
  savePhrases(phrases)
  res.status(201).json(newPhrases)
})

// PUT /api/phrases/:id
router.put('/:id', (req, res) => {
  const phrases = loadPhrases()
  const idx = phrases.findIndex(p => p.id === req.params.id)
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
    res.status(500).json({ error: err.message || 'Failed to generate metadata' })
  }
})

// DELETE /api/phrases/:id
router.delete('/:id', (req, res) => {
  const phrases = loadPhrases()
  const filtered = phrases.filter(p => p.id !== req.params.id)
  if (filtered.length === phrases.length)
    return res.status(404).json({ error: 'Phrase not found' })

  savePhrases(filtered)
  res.json({ success: true })
})

export default router
```

- [ ] **Step 2: Probar los endpoints con curl**

```bash
# Sugerencia automática
curl -s http://localhost:3001/api/phrases/suggest | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).phrase?.text?.substring(0,60)))"

# Check par
curl -s "http://localhost:3001/api/phrases/check-pair?phraseId=io-1&imageId=descarga.jfif"
```

Esperado: primera muestra texto de una frase. Segunda muestra `{"used":false}` o `{"used":true}`.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/phrases.ts
git commit -m "feat: endpoints suggest, check-pair, generate-ai y approve en phrases route"
```

---

## Task 5: Cleanup actualizado + endpoint manual

**Files:**
- Modify: `server/src/services/cleanupService.ts`
- Modify: `server/src/routes/videos.ts`

- [ ] **Step 1: Reemplazar server/src/services/cleanupService.ts**

```ts
import fs from 'fs'
import path from 'path'
import { VideoRecord } from '../types'

const OUTPUT_DIR = path.join(__dirname, '../../../output')
const OUTPUT_IMAGES_DIR = path.join(__dirname, '../../../output-images')
const DB_PATH = path.join(__dirname, '../../../data/videos.json')
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000  // 30 días
const VIDEO_EXTS = ['.mp4', '.mov']
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png']

function loadVideos(): VideoRecord[] {
  if (!fs.existsSync(DB_PATH)) return []
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

function saveVideos(videos: VideoRecord[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(videos, null, 2))
}

export interface CleanupStats {
  deletedVideos: number
  deletedImages: number
  freedMB: number
}

export function runCleanup(): CleanupStats {
  const now = Date.now()
  const stats: CleanupStats = { deletedVideos: 0, deletedImages: 0, freedMB: 0 }
  const deletedPaths = new Set<string>()

  const deleteOldFiles = (dir: string, validExts: string[]) => {
    if (!fs.existsSync(dir)) return
    for (const file of fs.readdirSync(dir)) {
      if (!validExts.includes(path.extname(file).toLowerCase())) continue
      const filePath = path.join(dir, file)
      try {
        const stats2 = fs.statSync(filePath)
        if (now - stats2.mtimeMs > MAX_AGE_MS) {
          stats.freedMB += stats2.size / (1024 * 1024)
          fs.unlinkSync(filePath)
          deletedPaths.add(filePath)
          if (validExts.includes('.mp4')) stats.deletedVideos++
          else stats.deletedImages++
        }
      } catch {}
    }
  }

  deleteOldFiles(OUTPUT_DIR, VIDEO_EXTS)
  deleteOldFiles(OUTPUT_IMAGES_DIR, IMAGE_EXTS)

  // Actualizar videos.json: marcar filesDeleted, limpiar localPath y publicUrl
  if (deletedPaths.size > 0) {
    const videos = loadVideos()
    let changed = false
    for (const video of videos) {
      if (!video.filesDeleted && video.localPath && deletedPaths.has(video.localPath)) {
        video.filesDeleted = true
        video.localPath = ''
        video.publicUrl = ''
        changed = true
      }
    }
    if (changed) saveVideos(videos)
  }

  stats.freedMB = Math.round(stats.freedMB * 10) / 10
  return stats
}

export function previewCleanup(): { fileCount: number; estimatedMB: number } {
  const now = Date.now()
  let fileCount = 0
  let estimatedMB = 0

  const scanDir = (dir: string, validExts: string[]) => {
    if (!fs.existsSync(dir)) return
    for (const file of fs.readdirSync(dir)) {
      if (!validExts.includes(path.extname(file).toLowerCase())) continue
      const filePath = path.join(dir, file)
      try {
        const s = fs.statSync(filePath)
        if (now - s.mtimeMs > MAX_AGE_MS) {
          fileCount++
          estimatedMB += s.size / (1024 * 1024)
        }
      } catch {}
    }
  }

  scanDir(OUTPUT_DIR, VIDEO_EXTS)
  scanDir(OUTPUT_IMAGES_DIR, IMAGE_EXTS)

  return { fileCount, estimatedMB: Math.round(estimatedMB * 10) / 10 }
}

export function startCleanupService() {
  console.log('✅ Cleanup service started. Will clean old files every 7 days.')
  cleanupAndLog()
  setInterval(cleanupAndLog, 7 * 24 * 60 * 60 * 1000)
}

function cleanupAndLog() {
  try {
    const stats = runCleanup()
    if (stats.deletedVideos > 0 || stats.deletedImages > 0) {
      console.log(`🧹 Cleanup: ${stats.deletedVideos} videos, ${stats.deletedImages} imágenes eliminados. ${stats.freedMB}MB liberados.`)
    }
  } catch (error: any) {
    console.error('❌ Cleanup Service Error:', error.message)
  }
}
```

- [ ] **Step 2: Añadir endpoint POST /api/videos/cleanup en server/src/routes/videos.ts**

Añadir este bloque ANTES del `export default router` final en `server/src/routes/videos.ts`:

```ts
import { runCleanup, previewCleanup } from '../services/cleanupService'

// GET /api/videos/cleanup/preview — cuánto espacio se liberará
router.get('/cleanup/preview', (_req, res) => {
  try {
    const preview = previewCleanup()
    res.json(preview)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/videos/cleanup — limpieza manual de assets +30 días
router.post('/cleanup', (_req, res) => {
  try {
    const stats = runCleanup()
    res.json({ success: true, ...stats })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
```

También añadir el import al inicio del archivo `server/src/routes/videos.ts` (junto a los otros imports):

```ts
import { runCleanup, previewCleanup } from '../services/cleanupService'
```

- [ ] **Step 3: Verificar que el servidor arranca y los endpoints responden**

```bash
curl -s http://localhost:3001/api/videos/cleanup/preview
```

Esperado: `{"fileCount":0,"estimatedMB":0}` (o con valores si hay archivos viejos)

- [ ] **Step 4: Commit**

```bash
git add server/src/services/cleanupService.ts server/src/routes/videos.ts
git commit -m "feat: cleanup 30 días, preserva huella JSON, endpoint manual /cleanup"
```

---

## Task 6: API cliente — nuevos métodos

**Files:**
- Modify: `client/src/api/index.ts`

- [ ] **Step 1: Añadir métodos a phrasesApi y videosApi en client/src/api/index.ts**

Añadir al objeto `phrasesApi` (después del método `generateMeta`):

```ts
  suggest: (imageId?: string) =>
    api
      .get<{
        phrase?: { id: string; text: string; category: string }
        imageId?: string
        imagePath?: string
        imageUrl?: string
        category?: string
        pairsRemaining?: number
        exhausted?: boolean
      }>('/phrases/suggest', { params: imageId ? { imageId } : {} })
      .then(r => r.data),

  checkPair: (phraseId: string, imageId: string) =>
    api
      .get<{ used: boolean }>('/phrases/check-pair', { params: { phraseId, imageId } })
      .then(r => r.data),

  generateAI: (category: string, count: number) =>
    api
      .post<{ generated: Array<{ id: string; text: string; category: string; status: string }> }>(
        '/phrases/generate-ai',
        { category, count }
      )
      .then(r => r.data),

  approve: (ids: string[]) =>
    api
      .patch<{ approved: number; discarded: number }>('/phrases/approve', { ids })
      .then(r => r.data),
```

Añadir al objeto `videosApi` (después del método `remove`):

```ts
  cleanupPreview: () =>
    api.get<{ fileCount: number; estimatedMB: number }>('/videos/cleanup/preview').then(r => r.data),

  cleanup: () =>
    api
      .post<{ success: boolean; deletedVideos: number; deletedImages: number; freedMB: number }>(
        '/videos/cleanup'
      )
      .then(r => r.data),
```

- [ ] **Step 2: Verificar que el cliente compila**

```bash
cd client && npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/index.ts
git commit -m "feat: métodos suggest, checkPair, generateAI, approve y cleanup en API cliente"
```

---

## Task 7: PhraseBank.tsx — Panel de administración con 3 bloques

**Files:**
- Modify: `client/src/components/PhraseBank/PhraseBank.tsx`

- [ ] **Step 1: Reemplazar client/src/components/PhraseBank/PhraseBank.tsx completo**

```tsx
import { useEffect, useState } from 'react'
import { Check, ChevronDown, Sparkles, ClipboardList, Trash2, Pencil, X } from 'lucide-react'
import { phrasesApi } from '../../api'
import { Phrase } from '../../types'
import { useVideoStore } from '../../store/videoStore'

const CATEGORIES = ['Sincronía Natural', 'Sabiduría del Cuerpo', 'Ritmo Vital'] as const
type Category = typeof CATEGORIES[number]

function parsePastedText(raw: string): string[] {
  const text = raw.trim()
  const numbered = text.split(/\n+/).filter(l => /^\d+[\.\)]\s+/.test(l.trim()))
  if (numbered.length > 1) return numbered.map(l => l.replace(/^\d+[\.\)]\s+/, '').trim()).filter(Boolean)
  const byParagraph = text.split(/\n\s*\n/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean)
  if (byParagraph.length > 1) return byParagraph
  const byBullet = text.split(/\n+/).filter(l => /^[-*•]\s+/.test(l.trim()))
  if (byBullet.length > 1) return byBullet.map(l => l.replace(/^[-*•]\s+/, '').trim()).filter(Boolean)
  const byLine = text.split(/\n+/).map(l => l.trim()).filter(Boolean)
  if (byLine.length > 1) return byLine
  return text ? [text] : []
}

export default function PhraseBank() {
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [filterCat, setFilterCat] = useState<Category | 'Todas'>('Todas')
  const [filterStatus, setFilterStatus] = useState<'active' | 'pending'>('active')
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const { setText, setSelectedPhraseId } = useVideoStore()

  // Bloque B — Import bulk
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importCategory, setImportCategory] = useState<Category>('Sincronía Natural')
  const [importPreview, setImportPreview] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  // Bloque C — Generar con IA
  const [showAI, setShowAI] = useState(false)
  const [aiCategory, setAiCategory] = useState<Category>('Sincronía Natural')
  const [aiCount, setAiCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [pendingApproval, setPendingApproval] = useState<Phrase[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState(false)

  const load = async () => {
    const data = await phrasesApi.list()
    setPhrases(data)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    setImportPreview(importText.trim() ? parsePastedText(importText) : [])
  }, [importText])

  const selectPhrase = (phrase: Phrase) => {
    setText({ content: phrase.text })
    setSelectedPhraseId(phrase.id)
  }

  const handleDelete = async (id: string) => {
    await phrasesApi.remove(id)
    load()
  }

  const handleEdit = async () => {
    if (!editId || !editText.trim()) return
    await phrasesApi.update(editId, { text: editText })
    setEditId(null)
    setEditText('')
    load()
  }

  const handleBulkImport = async () => {
    if (!importPreview.length) return
    setImporting(true)
    try {
      await phrasesApi.bulkCreate(importPreview, importCategory)
      setImportText('')
      setShowImport(false)
      load()
    } finally {
      setImporting(false)
    }
  }

  const handleGenerateAI = async () => {
    setGenerating(true)
    setPendingApproval([])
    setSelectedIds(new Set())
    try {
      const { generated } = await phrasesApi.generateAI(aiCategory, aiCount)
      setPendingApproval(generated as Phrase[])
      setSelectedIds(new Set(generated.map(p => p.id)))
    } finally {
      setGenerating(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      await phrasesApi.approve(Array.from(selectedIds))
      setPendingApproval([])
      setSelectedIds(new Set())
      setShowAI(false)
      load()
    } finally {
      setApproving(false)
    }
  }

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = phrases
    .filter(p => (p.status || 'active') === filterStatus)
    .filter(p => filterCat === 'Todas' || p.category === filterCat)

  return (
    <div className="flex flex-col gap-1 p-4">

      {/* ── Bloque A: Inventario ── */}
      <Block title="Inventario" defaultOpen>
        {/* Filtros */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {(['Todas', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`text-[9px] px-2 py-1 rounded-full border font-semibold transition-all ${
                filterCat === cat
                  ? 'bg-spirit-accent/20 border-spirit-accent text-white'
                  : 'bg-spirit-dark border-spirit-border text-spirit-muted hover:border-spirit-accent/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-3">
          {(['active', 'pending'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex-1 text-[9px] py-1 rounded-lg border font-semibold transition-all ${
                filterStatus === s
                  ? 'bg-spirit-accent/20 border-spirit-accent text-white'
                  : 'bg-spirit-dark border-spirit-border text-spirit-muted'
              }`}
            >
              {s === 'active' ? 'Activas' : 'Pendientes'}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="text-xs text-spirit-muted text-center py-4">Sin frases en este filtro</p>
          )}
          {filtered.map(phrase => (
            <div key={phrase.id} className="group bg-spirit-dark/60 border border-spirit-border/40 rounded-lg p-2.5">
              {editId === phrase.id ? (
                <div className="flex flex-col gap-1.5">
                  <textarea
                    className="w-full bg-spirit-dark border border-spirit-accent rounded px-2 py-1 text-xs text-white resize-none focus:outline-none"
                    rows={3}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                  />
                  <div className="flex gap-1.5">
                    <button onClick={handleEdit} className="flex-1 text-[10px] bg-spirit-accent text-white rounded py-1">Guardar</button>
                    <button onClick={() => { setEditId(null); setEditText('') }} className="flex-1 text-[10px] border border-spirit-border text-spirit-muted rounded py-1">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <button
                    className="flex-1 text-left"
                    onClick={() => selectPhrase(phrase)}
                  >
                    <p className="text-xs text-spirit-text leading-relaxed line-clamp-3">{phrase.text}</p>
                    <div className="flex gap-1.5 mt-1.5">
                      {phrase.category && (
                        <span className="text-[8px] text-spirit-accent/70 bg-spirit-accent/10 px-1.5 py-0.5 rounded">
                          {phrase.category}
                        </span>
                      )}
                      {(phrase.usageCount ?? 0) > 0 && (
                        <span className="text-[8px] text-spirit-muted">×{phrase.usageCount}</span>
                      )}
                    </div>
                  </button>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditId(phrase.id); setEditText(phrase.text) }}
                      className="text-spirit-muted hover:text-white p-1"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={() => handleDelete(phrase.id)}
                      className="text-spirit-muted hover:text-red-400 p-1"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Block>

      {/* ── Bloque B: Importar Bulk ── */}
      <Block title="Importar lista" icon={<ClipboardList size={11} />}>
        <select
          value={importCategory}
          onChange={e => setImportCategory(e.target.value as Category)}
          className="w-full bg-spirit-dark border border-spirit-border rounded-lg px-2 py-1.5 text-xs text-white mb-2 focus:outline-none focus:border-spirit-accent"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea
          className="w-full bg-spirit-dark border border-spirit-border rounded-lg p-2 text-xs text-white resize-none focus:outline-none focus:border-spirit-accent mb-2"
          rows={5}
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder="Pega tus frases aquí. Se detectan automáticamente separadas por párrafos, líneas en blanco, números (1. 2.) o guiones."
        />
        {importPreview.length > 0 && (
          <p className="text-[10px] text-green-400 mb-2">{importPreview.length} frase{importPreview.length !== 1 ? 's' : ''} detectada{importPreview.length !== 1 ? 's' : ''}</p>
        )}
        <button
          onClick={handleBulkImport}
          disabled={!importPreview.length || importing}
          className="w-full flex items-center justify-center gap-1.5 text-xs bg-spirit-accent/20 border border-spirit-accent text-white rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Check size={12} />
          {importing ? 'Importando...' : `Importar ${importPreview.length} frases`}
        </button>
      </Block>

      {/* ── Bloque C: Generar con IA ── */}
      <Block title="Generar con IA" icon={<Sparkles size={11} />}>
        {pendingApproval.length === 0 ? (
          <>
            <select
              value={aiCategory}
              onChange={e => setAiCategory(e.target.value as Category)}
              className="w-full bg-spirit-dark border border-spirit-border rounded-lg px-2 py-1.5 text-xs text-white mb-2 focus:outline-none focus:border-spirit-accent"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="mb-3">
              <label className="text-[10px] text-spirit-muted mb-1 block">Cantidad: {aiCount}</label>
              <input
                type="range" min={5} max={15} value={aiCount}
                onChange={e => setAiCount(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              onClick={handleGenerateAI}
              disabled={generating}
              className="w-full flex items-center justify-center gap-1.5 text-xs bg-spirit-accent/20 border border-spirit-accent text-white rounded-lg py-2 disabled:opacity-40 transition-all"
            >
              <Sparkles size={12} className={generating ? 'animate-pulse' : ''} />
              {generating ? 'Generando...' : `Generar ${aiCount} frases`}
            </button>
          </>
        ) : (
          <>
            <p className="text-[10px] text-spirit-muted mb-2">
              Selecciona las frases que quieres aprobar. Las desmarcadas se descartan.
            </p>
            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto mb-3">
              {pendingApproval.map(phrase => (
                <label
                  key={phrase.id}
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    selectedIds.has(phrase.id)
                      ? 'bg-spirit-accent/10 border-spirit-accent/40'
                      : 'bg-spirit-dark/60 border-spirit-border/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(phrase.id)}
                    onChange={() => toggleId(phrase.id)}
                    className="mt-0.5 accent-spirit-accent shrink-0"
                  />
                  <span className="text-[10px] text-spirit-text leading-relaxed">{phrase.text}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={selectedIds.size === 0 || approving}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-spirit-accent text-white rounded-lg py-2 disabled:opacity-40 transition-all"
              >
                <Check size={12} />
                {approving ? 'Guardando...' : `Aprobar ${selectedIds.size}`}
              </button>
              <button
                onClick={() => { setPendingApproval([]); setSelectedIds(new Set()) }}
                className="flex items-center justify-center text-spirit-muted hover:text-white border border-spirit-border rounded-lg px-3 py-2 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </>
        )}
      </Block>
    </div>
  )
}

function Block({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="py-3 border-b border-spirit-border/50 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-[11px] font-semibold uppercase tracking-widest text-spirit-accent hover:text-white transition-colors"
      >
        <span className="flex items-center gap-1.5">{icon}{title}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  )
}
```

- [ ] **Step 2: Actualizar phrasesApi.bulkCreate en client/src/api/index.ts para aceptar category**

Reemplaza el método `bulkCreate`:

```ts
  bulkCreate: (texts: string[], category?: string) =>
    api.post<Phrase[]>('/phrases/bulk', { texts, category }).then((r) => r.data),
```

- [ ] **Step 3: Verificar que el cliente compila sin errores**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add client/src/components/PhraseBank/PhraseBank.tsx client/src/api/index.ts
git commit -m "feat: PhraseBank rediseñado como panel admin con inventario, bulk import y generación IA"
```

---

## Task 8: Editor.tsx — Botón "Generar combinación nueva" + validación de par

**Files:**
- Modify: `client/src/pages/Editor.tsx`

- [ ] **Step 1: Añadir imports necesarios en client/src/pages/Editor.tsx**

Al inicio del archivo, añadir `Zap` al import de lucide-react y añadir `phrasesApi` al import de api:

```ts
import { Wand2, Upload, Send, RotateCcw, HardDrive, Zap } from 'lucide-react'
```

El import de api ya tiene `phrasesApi` si añadiste los métodos en Task 6. Si no, verifica que incluya:
```ts
import { videosApi, composerApi, phrasesApi, ComposedImageOutput } from '../api'
```

- [ ] **Step 2: Añadir estado para el botón de sugerencia en Editor.tsx**

Dentro del componente `Editor`, añadir junto a los otros estados:

```ts
const [suggesting, setSuggesting] = useState(false)
const [pairChip, setPairChip] = useState<{ category: string; remaining: number } | null>(null)
const [pairWarning, setPairWarning] = useState<string | null>(null)
```

- [ ] **Step 3: Añadir función handleSuggest en Editor.tsx**

Dentro del componente, después de los estados:

```ts
const handleSuggest = async () => {
  if (!config.imageId) {
    // Sin imagen seleccionada → sugerencia completa (frase + imagen)
    setSuggesting(true)
    setPairWarning(null)
    try {
      const result = await phrasesApi.suggest()
      if (result.exhausted) {
        setPairWarning('Todas las combinaciones usadas — agrega frases nuevas en la pestaña Frases')
        return
      }
      if (result.phrase && result.imageId) {
        setText({ content: result.phrase.text })
        setConfig({
          imageId: result.imageId,
          imagePath: result.imagePath ?? '',
          imagePreviewUrl: result.imageUrl ?? '',
        })
        setPairChip({ category: result.category ?? '', remaining: result.pairsRemaining ?? 0 })
      }
    } catch {
      setPairWarning('Error al sugerir combinación')
    } finally {
      setSuggesting(false)
    }
  } else {
    // Imagen ya seleccionada → sugerir solo frase compatible con esa imagen
    setSuggesting(true)
    setPairWarning(null)
    try {
      const result = await phrasesApi.suggest(config.imageId)
      if (result.exhausted) {
        setPairWarning('Esta imagen ya fue combinada con todas las frases disponibles')
        return
      }
      if (result.phrase) {
        setText({ content: result.phrase.text })
        setPairChip({ category: result.category ?? '', remaining: result.pairsRemaining ?? 0 })
      }
    } catch {
      setPairWarning('Error al sugerir frase')
    } finally {
      setSuggesting(false)
    }
  }
}
```

- [ ] **Step 4: Añadir el botón en el JSX de Editor.tsx**

En el panel de acciones (dentro del `<div className="flex flex-col gap-4 w-72 shrink-0">`), añadir ANTES del bloque `{/* Botón principal */}`:

```tsx
{/* Botón Generar combinación nueva */}
<button
  onClick={handleSuggest}
  disabled={suggesting || isGenerating}
  className="w-full flex items-center justify-center gap-2 bg-spirit-dark border border-spirit-accent/40 hover:border-spirit-accent hover:bg-spirit-accent/10 disabled:opacity-40 disabled:cursor-not-allowed text-spirit-accent rounded-xl px-4 py-3 transition-all text-sm font-medium"
>
  <Zap size={15} className={suggesting ? 'animate-pulse' : ''} />
  {suggesting ? 'Buscando...' : 'Generar combinación nueva'}
</button>

{/* Chip de categoría y pares restantes */}
{pairChip && !pairWarning && (
  <div className="flex items-center justify-between px-3 py-1.5 bg-spirit-accent/10 border border-spirit-accent/20 rounded-lg animate-fadeInUp">
    <span className="text-[10px] text-spirit-accent font-semibold">{pairChip.category}</span>
    <span className="text-[10px] text-spirit-muted">{pairChip.remaining} pares libres</span>
  </div>
)}

{/* Advertencia de par agotado */}
{pairWarning && (
  <p className="text-[10px] text-amber-400 text-center px-2 animate-fadeInUp">{pairWarning}</p>
)}
```

- [ ] **Step 5: Verificar que el cliente compila sin errores TypeScript**

```bash
cd client && npx tsc --noEmit
```

Esperado: sin errores nuevos.

- [ ] **Step 6: Prueba manual del flujo completo**

1. Abre la app en http://localhost:5173
2. Sin imagen seleccionada, presiona "Generar combinación nueva"
3. Verifica que se carga una imagen y una frase automáticamente
4. Verifica que aparece el chip con categoría y pares libres
5. Presiona de nuevo → debe cargar una combinación diferente
6. Ve a pestaña Frases → Generar con IA → selecciona categoría → Generar
7. Verifica que aparece el listado con checkboxes
8. Aprueba algunas frases → verifica que aparecen en Inventario → Activas

- [ ] **Step 7: Commit final**

```bash
git add client/src/pages/Editor.tsx
git commit -m "feat: botón Generar combinación nueva con sugerencia inteligente y validación de pares"
```

---

## Self-review del plan

**Spec coverage:**
- ✅ Sec 1: Tipos actualizados — Task 1
- ✅ Sec 2: Algoritmo suggest con categoría + usageCount — Task 2 (pairService)
- ✅ Sec 3: Botón "Generar combinación nueva" + chip + warning — Task 8
- ✅ Sec 4 Bloque A: Inventario con filtros — Task 7
- ✅ Sec 4 Bloque B: Bulk import con categoría — Task 7
- ✅ Sec 4 Bloque C: Generación IA + checkboxes — Task 7
- ✅ Sec 5: Cleanup 30 días, filesDeleted, output-images, preview + manual — Task 5
- ✅ Todos los endpoints nuevos — Tasks 4, 5

**Type consistency:**
- `suggestPair` → retorna `SuggestResult | { exhausted: true }` — consistente en pairService y route
- `phrasesApi.suggest` → retorna el mismo shape — consistente con el servidor
- `Phrase.status` definido en Task 1, usado en Tasks 2, 4, 7

**Sin placeholders:** verificado.
