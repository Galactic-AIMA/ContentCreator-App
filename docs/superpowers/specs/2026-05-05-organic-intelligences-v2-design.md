# OrganicIntelligences v2 — Spec de Diseño

**Fecha:** 2026-05-05  
**Proyecto:** `AppCreatorViralVideos/OrganicIntelligences`  
**Alcance:** Modo imagen (B+C), mejoras de UI/UX, limpieza de integraciones

---

## Contexto

OrganicIntelligences es una app full-stack (Vite+React+TypeScript / Express+Node) para crear videos verticales 9:16 con frases sobre imágenes de naturaleza. El contenido sigue la filosofía de "Inteligencia Orgánica": validar la experiencia humana a través de la biología. Cada pieza tiene estructura **gancho** (0-3s) + **remate** (4.5s-final), separados por `//` en el editor.

Esta versión añade un **Modo Imagen** para generar assets estáticos (JPG/PNG) además de videos, y aplica mejoras de calidad al editor existente.

---

## 1. Arquitectura General

### Toggle de modo

Un pill toggle debajo del logo del sidebar controla el modo activo globalmente:

```
[🎬 Video]  [🖼️ Imagen]
```

Ambos modos comparten: banco de imágenes, banco de frases, canvas preview, controles de estilo/tipografía/color/posición/marca.

### Cambios en `videoStore.ts`

```typescript
// Nuevos campos en el store
mode: 'video' | 'image'           // toggle global
imageFormat: 'jpeg' | 'png'       // formato de exportación
imageQuality: number              // 70–100 (solo JPEG)
setMode: (mode: 'video' | 'image') => void
setImageExport: (format, quality) => void
```

### Estructura frontend

```
Editor.tsx
├── Header/toggle: [🎬 Video] [🖼️ Imagen]
├── Sidebar izquierdo (w-80)
│   ├── Logo
│   ├── Tabs: Estilo | Imágenes | Frases
│   ├── VideoEditor.tsx
│   │   ├── Frase (siempre visible)
│   │   ├── Estilo de Video (siempre)
│   │   ├── Tipografía (siempre)
│   │   ├── Colores y Contorno (siempre)
│   │   ├── Efecto de Texto (SOLO modo video)
│   │   ├── Posición (siempre)
│   │   ├── Estética y Marca (siempre)
│   │   ├── Video / Duración+Transición (SOLO modo video)
│   │   └── Exportar Imagen (SOLO modo imagen)
│   └── Panel Meta (abajo)
├── Preview canvas (centro) — mismo para ambos modos
└── Panel acciones (derecha)
    ├── Modo video: [Generar video] [↺ Reset]
    │   └── VideoResult: Ver | Drive | Test n8n | Prod n8n
    └── Modo imagen: [Generar imagen] [↺ Reset]
        └── ImageResult: downloads + Drive
```

---

## 2. Modo Imagen — Lógica B+C

### Sección "Exportar Imagen" en el editor

Solo visible en modo imagen:
- **Formato:** toggle `JPEG | PNG`
- **Calidad:** slider 70–100 (visible solo si JPEG)

### Detección automática de `//`

El cliente detecta si `text.content` contiene `//`:

| Caso | Resultado |
|------|-----------|
| Sin `//` | 1 imagen (layout completo) |
| Con `//` | 3 imágenes: Combined (B) + Hook (C1) + Punchline (C2) |

### Cálculo de layouts para modo imagen

Nueva función `computeImageLayouts()` en `Editor.tsx`:

1. Divide el contenido en `ganchoText` (antes de `//`) y `remateText` (después de `//`)
2. Calcula `hookLayouts` con Y centrado en **35%** de H (≈ 672px en 1920)
3. Calcula `punchlineLayouts` con Y centrado en **70%** de H (≈ 1344px en 1920)
4. Para `combined`: fusiona ambos arrays de layouts
5. Para `hook-only`: solo hookLayouts
6. Para `punchline-only`: solo punchlineLayouts

### Request al servidor

```typescript
// POST /api/images/generate-composed
interface GenerateImageRequest {
  config: VideoConfig          // config completo (imagen, texto, estilo, fuente)
  format: 'jpeg' | 'png'
  quality: number
  hookLayouts?: SegmentLayout[]      // presentes si hay //
  hookLines?: string[]
  punchlineLayouts?: SegmentLayout[] // presentes si hay //
  punchlineLines?: string[]
}
```

### Response

```typescript
interface GenerateImageResponse {
  images: {
    type: 'single' | 'combined' | 'hook' | 'punchline'
    label: string              // "Imagen completa" | "Combinada" | "Solo Gancho" | "Solo Remate"
    filename: string
    publicUrl: string
  }[]
}
```

---

## 3. Backend — imageGenerator.ts

Nuevo servicio que reutiliza el 90% de `videoGenerator.ts`:

**Diferencias clave vs videoGenerator:**
- `-vframes 1` en vez de `-t {duration}`
- Sin efectos de texto animados (alpha siempre `1`)
- Sin fade in/fade out
- Sin cinematic grain (estático)
- Output a `/output-images/` con extensión `.jpg` o `.png`
- `-q:v 2` para JPEG (alta calidad) o `-compression_level 6` para PNG

**Función principal:**
```typescript
generateImage(
  cfg: VideoConfig,
  layouts: SegmentLayout[],
  lines: string[],
  outputName: string,
  format: 'jpeg' | 'png',
  quality: number
): Promise<ImageResult>
```

**Nueva ruta Express:** `POST /api/images/generate-composed`
- Genera 1 imagen (sin `//`) o 3 imágenes (con `//`) en secuencia
- Devuelve array de resultados

**Nueva ruta estática:**
```typescript
app.use('/output-images', express.static(path.resolve(config.paths.outputImages)))
```

**Nueva config en `config.ts`:**
```typescript
paths: {
  ...
  outputImages: process.env.OUTPUT_IMAGES_PATH || path.join(__dirname, '../../output-images'),
}
```

---

## 4. Componente ImageResult

Nuevo componente en `client/src/components/ImageResult/ImageResult.tsx`:

```
┌─────────────────────────────┐
│ 🖼️ Imagen generada          │
├─────────────────────────────┤
│ [thumbnail combinada]       │  ← solo si hay //
│ Combinada · PNG             │
│ [⬇ Descargar] [Drive ↗]    │
├─────────────────────────────┤
│ Solo Gancho  |  Solo Remate │  ← dos columnas si hay //
│ [⬇ Desc.]   |  [⬇ Desc.]   │
└─────────────────────────────┘
```

---

## 5. Mejoras de UI/UX incluidas

### 5.1 Secciones colapsables

`Section` en `VideoEditor.tsx` recibe prop `defaultOpen?: boolean`. Cada sección tiene un chevron toggle. Estado de colapso en `useState` local.

Secciones abiertas por defecto: Frase, Estilo de Video, Tipografía.  
Cerradas por defecto: Colores y Contorno, Efecto de Texto, Posición, Estética y Marca, Video/Exportar.

### 5.2 Toast notifications

Nuevo `useToast` hook + `Toast` componente mínimo (sin librerías externas):
- `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`
- Aparece bottom-right, auto-dismiss 4s
- Reemplaza todos los `alert()` en `Editor.tsx`

### 5.3 Quitar S3

- Eliminar botón "S3" del panel de acciones de video
- Eliminar `uploadToS3` function de `Editor.tsx`
- Mantener la ruta `/api/videos/:id/upload-s3` en el servidor (no romper API, solo ocultar UI)

### 5.4 Fix watermark URL hardcodeada

En `VideoPreview.tsx` línea 353:
```typescript
// Antes (hardcodeado):
logo.src = 'http://localhost:3001/data/logo.png'

// Después (configurable):
logo.src = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/data/logo.png`
```

Agregar `VITE_API_URL=http://localhost:3001` a `.env.example`.

---

## 6. Backup antes de cambios

Copiar `client/src/` y `server/src/` a `_backup_2026-05-05/` en la raíz del proyecto antes de cualquier modificación.

---

## 7. Fuera de alcance (v3+)

- Preview animado de efectos de texto en el canvas
- Auto-generación de meta con IA (título/descripción/tags)
- Historial de videos/imágenes generados con UI
- Modo batch (generar múltiples frases en cola)
- Migración de JSON a SQLite

---

## Checklist de implementación

- [ ] Backup de `client/src/` y `server/src/`
- [ ] `videoStore.ts`: agregar `mode`, `imageFormat`, `imageQuality`
- [ ] `VideoEditor.tsx`: secciones colapsables + ocultar secciones por modo
- [ ] `Editor.tsx`: toggle de modo + `computeImageLayouts()` + `generateImage()`
- [ ] `Toast` hook + componente, reemplazar `alert()`
- [ ] Quitar botón S3 del panel de acciones
- [ ] Fix watermark URL en `VideoPreview.tsx`
- [ ] `imageGenerator.ts`: nuevo servicio FFmpeg para imágenes estáticas
- [ ] `config.ts`: agregar `outputImages` path
- [ ] `server/src/index.ts`: nueva ruta estática + importar router
- [ ] `server/src/routes/images.ts`: nueva ruta `POST /generate-composed`
- [ ] `ImageResult.tsx`: componente de resultados de imagen
- [ ] `client/src/api/index.ts`: agregar método `generateComposed`
- [ ] `.env.example`: agregar `VITE_API_URL` y `OUTPUT_IMAGES_PATH`
- [ ] Memoria Obsidian del proceso
