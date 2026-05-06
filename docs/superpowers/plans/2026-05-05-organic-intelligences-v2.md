# OrganicIntelligences v2 — Plan de Implementación

> **Para workers agénticos:** SUB-SKILL REQUERIDO: Usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan sintaxis checkbox (`- [ ]`) para seguimiento.

**Goal:** Agregar Modo Imagen (B+C) con generación FFmpeg de estáticos, más mejoras de UI/UX al editor existente.

**Architecture:** El cliente calcula layouts separados para gancho/remate a distintas posiciones Y; el servidor los recibe y genera 1-3 imágenes JPG/PNG con `-vframes 1`. Un toggle de modo controla qué secciones del editor son visibles. El store de Zustand añade `mode`, `imageFormat`, `imageQuality`.

**Tech Stack:** React + Vite + TypeScript + Tailwind + Zustand (cliente), Express + Node.js + fluent-ffmpeg (servidor), Axios (API client).

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `_backup_2026-05-05/` (copia de seguridad) |
| Modificar | `client/src/store/videoStore.ts` |
| Crear | `client/src/hooks/useToast.ts` |
| Crear | `client/src/components/Toast/Toast.tsx` |
| Modificar | `client/src/components/VideoEditor/VideoEditor.tsx` |
| Modificar | `client/src/components/Preview/VideoPreview.tsx` |
| Modificar | `client/src/pages/Editor.tsx` |
| Modificar | `client/src/api/index.ts` |
| Crear | `client/src/components/ImageResult/ImageResult.tsx` |
| Crear | `server/src/services/imageGenerator.ts` |
| Modificar | `server/src/config.ts` |
| Modificar | `server/src/index.ts` |
| Crear | `server/src/routes/compose.ts` |
| Modificar | `.env.example` |

---

## Task 1: Backup de archivos fuente

**Files:**
- Crear: `_backup_2026-05-05/` (carpeta de backup)

- [ ] **Paso 1: Crear backup con PowerShell**

```powershell
$src = "D:\GalacticAIMA\AppCreatorViralVideos\OrganicIntelligences"
$dst = "$src\_backup_2026-05-05"
New-Item -ItemType Directory -Path $dst -Force
Copy-Item "$src\client\src" "$dst\client\src" -Recurse
Copy-Item "$src\server\src" "$dst\server\src" -Recurse
Write-Host "Backup completado en $_backup_2026-05-05"
```

Resultado esperado: carpeta `_backup_2026-05-05/` con subdirectorios `client/src/` y `server/src/`.

---

## Task 2: videoStore.ts — agregar mode, imageFormat, imageQuality

**Files:**
- Modificar: `client/src/store/videoStore.ts`

- [ ] **Paso 1: Leer el archivo actual**

Leer `client/src/store/videoStore.ts` para confirmar las interfaces existentes antes de editar.

- [ ] **Paso 2: Agregar campos al store**

Reemplazar la interfaz `VideoStore` y la implementación del store con:

```typescript
import { create } from 'zustand'
import { VideoConfig, VideoMeta, TextConfig } from '../types'

const DEFAULT_TEXT: TextConfig = {
  content: 'Tu frase aquí...',
  font: "'Inter', sans-serif",
  fontSize: 42,
  color: '#ffffff',
  position: { x: 50, y: 50 },
  align: 'center',
  shadow: true,
  maxWidth: 85,
  lineHeight: 1.4,
  fontWeight: 400,
  fontStyle: 'normal',
  highlightColor: '#FFD700',
  strokeColor: '#000000',
  strokeWidth: 0,
}

const DEFAULT_CONFIG: VideoConfig = {
  imageId: '',
  imagePath: '',
  imagePreviewUrl: '',
  duration: 10,
  transition: 'fadeBlack',
  transitionDuration: 1.0,
  text: DEFAULT_TEXT,
  resolution: { width: 1080, height: 1920 },
  style: 'serene',
  textEffect: 'fadeIn',
  watermark: true,
  watermarkPosition: 'top-right',
  cinematicGrain: false,
}

const DEFAULT_META: VideoMeta = {
  title: '',
  description: '',
  tags: [],
}

interface VideoStore {
  config: VideoConfig
  meta: VideoMeta
  selectedPhraseId: string | null
  isGenerating: boolean
  mode: 'video' | 'image'
  imageFormat: 'jpeg' | 'png'
  imageQuality: number
  setConfig: (partial: Partial<VideoConfig>) => void
  setText: (partial: Partial<TextConfig>) => void
  setMeta: (partial: Partial<VideoMeta>) => void
  setSelectedPhraseId: (id: string | null) => void
  setGenerating: (v: boolean) => void
  setMode: (mode: 'video' | 'image') => void
  setImageExport: (format: 'jpeg' | 'png', quality: number) => void
  reset: () => void
}

export const useVideoStore = create<VideoStore>((set) => ({
  config: DEFAULT_CONFIG,
  meta: DEFAULT_META,
  selectedPhraseId: null,
  isGenerating: false,
  mode: 'video',
  imageFormat: 'jpeg',
  imageQuality: 90,
  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),
  setText: (partial) =>
    set((s) => ({ config: { ...s.config, text: { ...s.config.text, ...partial } } })),
  setMeta: (partial) =>
    set((s) => ({ meta: { ...s.meta, ...partial } })),
  setSelectedPhraseId: (id) => set({ selectedPhraseId: id }),
  setGenerating: (v) => set({ isGenerating: v }),
  setMode: (mode) => set({ mode }),
  setImageExport: (imageFormat, imageQuality) => set({ imageFormat, imageQuality }),
  reset: () => set({ config: DEFAULT_CONFIG, meta: DEFAULT_META, selectedPhraseId: null }),
}))
```

- [ ] **Paso 3: Verificar que el servidor de desarrollo no lanza errores de TypeScript**

```powershell
cd "D:\GalacticAIMA\AppCreatorViralVideos\OrganicIntelligences"
npm run dev --workspace=client
```

Resultado esperado: servidor Vite arranca sin errores de TS. Detener con Ctrl+C.

---

## Task 3: Toast — hook y componente

**Files:**
- Crear: `client/src/hooks/useToast.ts`
- Crear: `client/src/components/Toast/Toast.tsx`

- [ ] **Paso 1: Crear el hook useToast**

Crear `client/src/hooks/useToast.ts`:

```typescript
import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((message: string, type: ToastType) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return {
    toasts,
    toast: {
      success: (msg: string) => add(msg, 'success'),
      error: (msg: string) => add(msg, 'error'),
      info: (msg: string) => add(msg, 'info'),
    },
  }
}
```

- [ ] **Paso 2: Crear el componente Toast**

Crear `client/src/components/Toast/Toast.tsx`:

```tsx
import { CheckCircle, XCircle, Info } from 'lucide-react'
import { ToastItem } from '../../hooks/useToast'

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const COLORS = {
  success: 'bg-green-900/80 border-green-700/40 text-green-300',
  error: 'bg-red-900/80 border-red-700/40 text-red-300',
  info: 'bg-blue-900/80 border-blue-700/40 text-blue-300',
}

export default function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-lg animate-fadeInUp ${COLORS[t.type]}`}
          >
            <Icon size={15} />
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
```

---

## Task 4: VideoEditor — secciones colapsables + modo-aware

**Files:**
- Modificar: `client/src/components/VideoEditor/VideoEditor.tsx`

- [ ] **Paso 1: Agregar import de ChevronDown y useState**

Al inicio del archivo, cambiar los imports de React:

```typescript
import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useVideoStore } from '../../store/videoStore'
import { TransitionType, TextAlign, VideoStyle, TextEffect } from '../../types'
```

- [ ] **Paso 2: Leer modo del store en VideoEditor**

Dentro del componente `VideoEditor`, agregar al destructuring del store:

```typescript
export default function VideoEditor() {
  const { config, setConfig, setText, mode, imageFormat, imageQuality, setImageExport } = useVideoStore()
  const { text, duration, transition, transitionDuration, style, textEffect, watermark, watermarkPosition, cinematicGrain } = config
  // ... resto igual
```

- [ ] **Paso 3: Reemplazar el componente Section al final del archivo**

Reemplazar la función `Section` existente por esta versión con colapso:

```tsx
function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
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
        {title}
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  )
}
```

- [ ] **Paso 4: Actualizar props defaultOpen por sección y ocultar secciones video-only**

En el `return` de `VideoEditor`, actualizar los `<Section>` con `defaultOpen` y condicionales de modo. Reemplazar todas las secciones por:

```tsx
return (
  <div className="flex flex-col gap-1 p-4 animate-fadeInUp">

    {/* ── Frase ── */}
    <Section title="Frase" defaultOpen={true}>
      <textarea
        className="w-full bg-spirit-dark border border-spirit-border rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-spirit-accent transition-colors"
        rows={3}
        value={text.content}
        onChange={(e) => setText({ content: e.target.value })}
        placeholder="Escribe tu frase...  Usa [corchetes] para resaltar. Usa // para gancho//remate"
      />
      <p className="text-[10px] text-spirit-muted mt-1 italic">
        Tip: <span className="text-spirit-accent">[palabra]</span> resalta · <span className="text-spirit-accent">//</span> separa gancho y remate
      </p>
    </Section>

    {/* ── Estilo de Video ── */}
    <Section title="Estilo de Video" defaultOpen={true}>
      <div className="grid grid-cols-5 gap-1.5">
        {STYLES.map((s) => (
          <button
            key={s.value}
            onClick={() => setConfig({ style: s.value })}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-[10px] font-medium transition-all ${
              style === s.value
                ? 'bg-spirit-accent/20 border-spirit-accent text-white shadow-md shadow-spirit-accent/20'
                : 'bg-spirit-dark border-spirit-border text-spirit-muted hover:border-spirit-accent/40 hover:text-white'
            }`}
          >
            <span className="text-base">{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>
    </Section>

    {/* ── Tipografía ── */}
    <Section title="Tipografía" defaultOpen={true}>
      <select
        className="w-full bg-spirit-dark border border-spirit-border rounded-lg p-2 text-sm text-white focus:border-spirit-accent focus:outline-none transition-colors"
        value={text.font}
        onChange={(e) => setText({ font: e.target.value })}
      >
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setText({ fontWeight: text.fontWeight === 800 ? 400 : 800 })}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm transition-all duration-200 ${
            text.fontWeight === 800
              ? 'bg-gradient-to-r from-spirit-accent to-purple-500 text-white shadow-lg shadow-spirit-accent/30 scale-[1.02]'
              : 'bg-spirit-dark/80 border border-spirit-border text-spirit-muted hover:text-white hover:border-spirit-accent/50'
          }`}
        >
          <span className="font-black text-base">B</span>
          <span className="text-[10px] opacity-70">Bold</span>
        </button>
        <button
          onClick={() => setText({ fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm transition-all duration-200 ${
            text.fontStyle === 'italic'
              ? 'bg-gradient-to-r from-spirit-accent to-purple-500 text-white shadow-lg shadow-spirit-accent/30 scale-[1.02]'
              : 'bg-spirit-dark/80 border border-spirit-border text-spirit-muted hover:text-white hover:border-spirit-accent/50'
          }`}
        >
          <span className="italic font-serif text-base">I</span>
          <span className="text-[10px] opacity-70">Italic</span>
        </button>
      </div>
      <div className="mt-3">
        <label className="text-xs text-spirit-muted mb-1 block">Tamaño: {text.fontSize}px</label>
        <input
          type="range" min={20} max={120} value={text.fontSize}
          onChange={(e) => setText({ fontSize: Number(e.target.value) })}
          className="w-full"
        />
      </div>
    </Section>

    {/* ── Colores y Contorno ── */}
    <Section title="Colores y Contorno" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-spirit-muted mb-1 block">Texto</label>
          <div className="flex items-center gap-2">
            <input type="color" value={text.color} onChange={(e) => setText({ color: e.target.value })}
              className="w-full h-8 rounded-lg bg-spirit-dark border border-spirit-border cursor-pointer" />
            <button onClick={() => setText({ color: '#ffffff' })}
              className="text-[9px] text-spirit-muted hover:text-white px-1.5 py-1 border border-spirit-border rounded transition-colors">↺</button>
          </div>
        </div>
        <div>
          <label className="text-xs text-spirit-muted mb-1 block">Resaltado [...]</label>
          <div className="flex items-center gap-2">
            <input type="color" value={text.highlightColor} onChange={(e) => setText({ highlightColor: e.target.value })}
              className="w-full h-8 rounded-lg bg-spirit-dark border border-spirit-border cursor-pointer" />
            <button onClick={() => setText({ highlightColor: '#FFD700' })}
              className="text-[9px] text-spirit-muted hover:text-white px-1.5 py-1 border border-spirit-border rounded transition-colors">↺</button>
          </div>
        </div>
      </div>
      <div className="mt-3 p-3 rounded-xl border border-spirit-border/50 bg-spirit-dark/50">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-spirit-muted flex items-center gap-1.5">
            <span className="text-sm">◯</span> Contorno
          </label>
          <button
            onClick={() => setText({ strokeWidth: text.strokeWidth > 0 ? 0 : 3 })}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
              text.strokeWidth > 0
                ? 'bg-spirit-accent/20 border-spirit-accent text-white'
                : 'border-spirit-border text-spirit-muted hover:border-spirit-accent/40'
            }`}
          >
            {text.strokeWidth > 0 ? 'ON' : 'OFF'}
          </button>
        </div>
        {text.strokeWidth > 0 && (
          <div className="flex flex-col gap-2 animate-fadeInUp">
            <div className="flex items-center gap-2">
              <input type="color" value={text.strokeColor} onChange={(e) => setText({ strokeColor: e.target.value })}
                className="w-12 h-7 rounded bg-spirit-dark border border-spirit-border cursor-pointer" />
              <div className="flex-1">
                <label className="text-[10px] text-spirit-muted">Grosor: {text.strokeWidth}px</label>
                <input type="range" min={1} max={12} value={text.strokeWidth}
                  onChange={(e) => setText({ strokeWidth: Number(e.target.value) })}
                  className="w-full" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>

    {/* ── Efecto de Texto (solo modo video) ── */}
    {mode === 'video' && (
      <Section title="Efecto de Texto" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-1.5">
          {EFFECTS.map((e) => (
            <button
              key={e.value}
              onClick={() => setConfig({ textEffect: e.value })}
              className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-[10px] font-medium transition-all duration-200 ${
                textEffect === e.value
                  ? 'bg-gradient-to-b from-spirit-accent/20 to-spirit-accent/5 border-spirit-accent text-white shadow-md shadow-spirit-accent/10'
                  : 'bg-spirit-dark border-spirit-border text-spirit-muted hover:border-spirit-accent/40 hover:text-white'
              }`}
            >
              <span className="text-sm">{e.emoji}</span>
              {e.label}
            </button>
          ))}
        </div>
      </Section>
    )}

    {/* ── Estética y Marca ── */}
    <Section title="Estética y Marca" defaultOpen={false}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="watermark" checked={watermark}
            onChange={(e) => setConfig({ watermark: e.target.checked })}
            className="accent-spirit-accent" />
          <label htmlFor="watermark" className="text-sm text-spirit-text">Logo</label>
        </div>
        {mode === 'video' && (
          <div className="flex items-center gap-2">
            <input type="checkbox" id="grain" checked={cinematicGrain}
              onChange={(e) => setConfig({ cinematicGrain: e.target.checked })}
              className="accent-spirit-accent" />
            <label htmlFor="grain" className="text-sm text-spirit-text">Grano Cine</label>
          </div>
        )}
      </div>
      {watermark && (
        <div className="mb-4">
          <label className="text-xs text-spirit-muted mb-2 block text-center uppercase tracking-widest font-bold">Posición Logo</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'top-left', l: 'Sup. Izq' },
              { v: 'top-right', l: 'Sup. Der' },
              { v: 'bottom-left', l: 'Inf. Izq' },
              { v: 'bottom-right', l: 'Inf. Der' },
            ].map((pos) => (
              <button key={pos.v} onClick={() => setConfig({ watermarkPosition: pos.v as any })}
                className={`py-1.5 rounded-md border text-[9px] uppercase font-medium transition-all ${
                  watermarkPosition === pos.v
                    ? 'bg-spirit-accent/20 border-spirit-accent text-white'
                    : 'bg-spirit-dark border-spirit-border text-spirit-muted'
                }`}>
                {pos.l}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-2">
        <label className="text-xs text-spirit-muted mb-2 block uppercase tracking-widest font-bold">Color Resaltado</label>
        <div className="flex gap-2">
          {[
            { c: '#E9D5A3', n: 'Oro' },
            { c: '#94A684', n: 'Sabio' },
            { c: '#D4A373', n: 'Tierra' },
            { c: '#FACC15', n: 'Sol' },
          ].map((color) => (
            <button key={color.c} onClick={() => setText({ highlightColor: color.c })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                text.highlightColor === color.c ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color.c }} title={color.n} />
          ))}
        </div>
      </div>
    </Section>

    {/* ── Posición ── */}
    <Section title="Posición" defaultOpen={false}>
      <div className="flex gap-2 mb-4">
        {(['left', 'center', 'right'] as const).map((a) => (
          <button key={a} onClick={() => setText({ align: a })}
            className={`flex-1 py-1.5 rounded-md border text-[10px] uppercase font-bold transition-all ${
              text.align === a
                ? 'bg-spirit-accent border-spirit-accent text-white shadow-lg shadow-spirit-accent/20'
                : 'bg-spirit-dark border-spirit-border text-spirit-muted hover:border-spirit-accent/50'
            }`}>
            {a === 'left' ? 'Izquierda' : a === 'center' ? 'Centro' : 'Derecha'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-spirit-muted mb-1 block">Horizontal: {text.position.x}%</label>
          <input type="range" min={0} max={100} value={text.position.x}
            onChange={(e) => setText({ position: { ...text.position, x: Number(e.target.value) } })}
            className="w-full" />
        </div>
        <div>
          <label className="text-xs text-spirit-muted mb-1 block">Vertical: {text.position.y}%</label>
          <input type="range" min={5} max={95} value={text.position.y}
            onChange={(e) => setText({ position: { ...text.position, y: Number(e.target.value) } })}
            className="w-full" />
        </div>
        <div>
          <label className="text-xs text-spirit-muted mb-1 block">Ancho máx: {text.maxWidth}%</label>
          <input type="range" min={30} max={95} value={text.maxWidth}
            onChange={(e) => setText({ maxWidth: Number(e.target.value) })}
            className="w-full" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="shadow" checked={text.shadow}
            onChange={(e) => setText({ shadow: e.target.checked })}
            className="accent-spirit-accent" />
          <label htmlFor="shadow" className="text-sm text-spirit-text">Sombra</label>
        </div>
      </div>
    </Section>

    {/* ── Video (solo modo video) ── */}
    {mode === 'video' && (
      <Section title="Video" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-spirit-muted mb-1 block">Duración: {duration}s</label>
            <input type="range" min={5} max={30} value={duration}
              onChange={(e) => setConfig({ duration: Number(e.target.value) })}
              className="w-full" />
          </div>
          <div>
            <label className="text-xs text-spirit-muted mb-1 block">Transición</label>
            <select className="w-full bg-spirit-dark border border-spirit-border rounded-lg p-2 text-sm text-white focus:border-spirit-accent focus:outline-none transition-colors"
              value={transition} onChange={(e) => setConfig({ transition: e.target.value as TransitionType })}>
              {TRANSITIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {transition !== 'none' && (
            <div className="col-span-2">
              <label className="text-xs text-spirit-muted mb-1 block">
                Duración transición: {transitionDuration}s
              </label>
              <input type="range" min={0.3} max={2} step={0.1} value={transitionDuration}
                onChange={(e) => setConfig({ transitionDuration: Number(e.target.value) })}
                className="w-full" />
            </div>
          )}
        </div>
      </Section>
    )}

    {/* ── Exportar Imagen (solo modo imagen) ── */}
    {mode === 'image' && (
      <Section title="Exportar Imagen" defaultOpen={true}>
        <div className="flex gap-2 mb-3">
          {(['jpeg', 'png'] as const).map((fmt) => (
            <button key={fmt} onClick={() => setImageExport(fmt, imageQuality)}
              className={`flex-1 py-2 rounded-lg border text-xs font-semibold uppercase transition-all ${
                imageFormat === fmt
                  ? 'bg-spirit-accent/20 border-spirit-accent text-white'
                  : 'bg-spirit-dark border-spirit-border text-spirit-muted hover:border-spirit-accent/40'
              }`}>
              {fmt}
            </button>
          ))}
        </div>
        {imageFormat === 'jpeg' && (
          <div>
            <label className="text-xs text-spirit-muted mb-1 block">
              Calidad: {imageQuality}%
            </label>
            <input type="range" min={70} max={100} value={imageQuality}
              onChange={(e) => setImageExport('jpeg', Number(e.target.value))}
              className="w-full" />
          </div>
        )}
      </Section>
    )}

  </div>
)
```

- [ ] **Paso 5: Verificar que el editor carga correctamente en el navegador**

Arrancar dev y confirmar visualmente que las secciones colapsan/expanden y el toggle de modo funciona.

---

## Task 5: Fix watermark URL en VideoPreview.tsx

**Files:**
- Modificar: `client/src/components/Preview/VideoPreview.tsx:353`

- [ ] **Paso 1: Reemplazar URL hardcodeada**

Buscar la línea:
```typescript
logo.src = 'http://localhost:3001/data/logo.png'
```

Reemplazar por:
```typescript
logo.src = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/data/logo.png`
```

---

## Task 6: Quitar S3 del panel de acciones

**Files:**
- Modificar: `client/src/pages/Editor.tsx`
- Modificar: `client/src/api/index.ts`

- [ ] **Paso 1: Eliminar import de Upload de lucide en Editor.tsx**

En Editor.tsx, cambiar:
```typescript
import { Wand2, Upload, Send, RotateCcw, HardDrive } from 'lucide-react'
```
Por:
```typescript
import { Wand2, Send, RotateCcw, HardDrive } from 'lucide-react'
```

- [ ] **Paso 2: Eliminar función uploadToS3 en Editor.tsx**

Eliminar completamente el bloque:
```typescript
const uploadToS3 = async () => {
  if (!lastVideo) return
  await videosApi.uploadToS3(lastVideo.id)
  alert('Subido a S3 correctamente')
}
```

- [ ] **Paso 3: Eliminar el botón S3 del JSX en Editor.tsx**

En el panel de acciones post-generación, eliminar el botón:
```tsx
<button
  onClick={uploadToS3}
  className="flex items-center justify-center gap-1.5 bg-spirit-card hover:bg-spirit-border border border-spirit-border text-white rounded-lg px-2 py-2 transition-colors text-xs font-medium"
>
  <Upload size={13} /> S3
</button>
```

Cambiar el `grid grid-cols-2` restante a `grid grid-cols-3` (Drive + Test n8n + Prod n8n).

---

## Task 7: Backend — imageGenerator.ts

**Files:**
- Crear: `server/src/services/imageGenerator.ts`

- [ ] **Paso 1: Crear el servicio imageGenerator.ts**

Crear `server/src/services/imageGenerator.ts`:

```typescript
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { VideoConfig, SegmentLayout } from '../types'
import { config } from '../config'

const WINDOWS_FONTS = 'C:/Windows/Fonts'

const FONT_FALLBACKS: Record<string, string> = {
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
}

function resolveFontPath(fontName: string): string {
  const cleanName = fontName.replace(/'/g, '').split(',')[0].trim()
  const customFont = path.join(config.paths.fonts, `${cleanName}.ttf`)
  const resolved = fs.existsSync(customFont)
    ? customFont
    : (FONT_FALLBACKS[cleanName] || `${WINDOWS_FONTS}/arial.ttf`)
  return resolved.replace(/\\/g, '/').replace(/^([A-Z]):/, '$1\\:')
}

function escapeLine(text: string): string {
  return text.replace(/'/g, "''").replace(/:/g, '\\:')
}

// Mapea calidad 70-100% → FFmpeg q:v 10-2 (inverso: mayor calidad = menor q:v)
function jpegQualityToFfmpeg(quality: number): number {
  return Math.max(2, Math.round(10 - (quality - 70) * 8 / 30))
}

export interface ImageResult {
  filename: string
  localPath: string
  publicUrl: string
}

export async function generateImage(
  cfg: VideoConfig,
  layouts: SegmentLayout[],
  outputName: string,
  format: 'jpeg' | 'png',
  quality: number,
): Promise<ImageResult> {
  const outputDir = path.resolve(config.paths.outputImages)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const ext = format === 'jpeg' ? '.jpg' : '.png'
  const filename = `${outputName}${ext}`
  const outputPath = path.join(outputDir, filename)

  const { width, height } = cfg.resolution
  const { text } = cfg
  const fontPath = resolveFontPath(text.font)

  // Construir drawtext filters — alpha siempre 1 (sin animaciones)
  const drawTextFilters = layouts
    .filter((seg) => seg.text.trim().length > 0)
    .map((segObj) => {
      const strokeOpts = text.strokeWidth > 0
        ? `:borderw=${text.strokeWidth}:bordercolor=${text.strokeColor.replace('#', '0x')}@1`
        : ''
      const shadowOpts = text.shadow && text.strokeWidth === 0
        ? ':shadowcolor=black@0.7:shadowx=2:shadowy=3'
        : ''

      let xExpr = `${Math.round(segObj.x)}`
      if (text.align === 'center' && (segObj as any).lineW) {
        const offset = Math.round(segObj.x - (Math.round(width / 2) - Math.round((segObj as any).lineW / 2)))
        xExpr = `(w-${(segObj as any).lineW})/2+${offset}`
      }

      return (
        `drawtext=text='${escapeLine(segObj.text.trim())}':` +
        `fontfile='${fontPath}':` +
        `fontsize=${text.fontSize}:` +
        `fontcolor=${segObj.color.replace('#', '0x')}:` +
        `x=${xExpr}:y=${segObj.y}` +
        strokeOpts +
        shadowOpts
      )
    })

  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    ...drawTextFilters,
  ]

  let overlayPos = 'W-w-30:30'
  if (cfg.watermarkPosition === 'top-left') overlayPos = '30:30'
  if (cfg.watermarkPosition === 'bottom-right') overlayPos = 'W-w-30:H-h-30'
  if (cfg.watermarkPosition === 'bottom-left') overlayPos = '30:H-h-30'

  const filterScriptPath = path.join(outputDir, `img_filters_${Date.now()}.txt`)
  if (cfg.watermark) {
    fs.writeFileSync(filterScriptPath,
      `[0:v]${filters.join(',')}[bg];[1:v]scale=120:-1,format=rgba,colorchannelmixer=aa=0.6[wm];[bg][wm]overlay=${overlayPos}`
    )
  } else {
    fs.writeFileSync(filterScriptPath, `[0:v]${filters.join(',')}`)
  }

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(cfg.imagePath)
      .inputOptions(['-loop 1', '-t 1'])

    if (cfg.watermark) {
      const logoPath = path.resolve(__dirname, '../../../data/logo.png')
      cmd.input(logoPath)
    }

    const safePath = filterScriptPath.replace(/\\/g, '/')
    cmd.inputOptions(['-filter_complex_script', safePath])

    const outputOptions = [
      '-vframes 1',
      '-pix_fmt yuvj420p',
    ]

    if (format === 'jpeg') {
      outputOptions.push(`-q:v ${jpegQualityToFfmpeg(quality)}`)
    }

    cmd
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('end', () => {
        try { fs.unlinkSync(filterScriptPath) } catch {}
        resolve({
          filename,
          localPath: outputPath,
          publicUrl: `${config.publicBaseUrl}/output-images/${filename}`,
        })
      })
      .on('error', (err) => reject(new Error(`FFmpeg image error: ${err.message}`)))
      .run()
  })
}
```

---

## Task 8: config.ts + server/index.ts — outputImages path

**Files:**
- Modificar: `server/src/config.ts`
- Modificar: `server/src/index.ts`

- [ ] **Paso 1: Agregar outputImages a config.ts**

En `server/src/config.ts`, dentro del objeto `paths`, agregar:

```typescript
outputImages: process.env.OUTPUT_IMAGES_PATH || path.join(__dirname, '../../output-images'),
```

El bloque `paths` completo queda:

```typescript
paths: {
  images: process.env.IMAGES_PATH || path.join(__dirname, '../../data/images'),
  output: process.env.OUTPUT_PATH || path.join(__dirname, '../../output'),
  outputImages: process.env.OUTPUT_IMAGES_PATH || path.join(__dirname, '../../output-images'),
  fonts: process.env.FONTS_PATH || path.join(__dirname, '../../data/fonts'),
  phrases: path.join(__dirname, '../../data/phrases.json'),
},
```

- [ ] **Paso 2: Registrar ruta estática y router en server/index.ts**

En `server/src/index.ts`, agregar:

```typescript
import composeRouter from './routes/compose'
```

Y después de la línea `app.use('/output', ...)`:

```typescript
app.use('/output-images', express.static(path.resolve(config.paths.outputImages)))
app.use('/api/compose', composeRouter)
```

---

## Task 9: Ruta compose.ts — POST /api/compose/image

**Files:**
- Crear: `server/src/routes/compose.ts`

- [ ] **Paso 1: Crear el router compose.ts**

Crear `server/src/routes/compose.ts`:

```typescript
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { generateImage, ImageResult } from '../services/imageGenerator'
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
      // Imagen única
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
```

---

## Task 10: API client — composerApi

**Files:**
- Modificar: `client/src/api/index.ts`

- [ ] **Paso 1: Agregar tipos y método generateComposed**

Al inicio de `client/src/api/index.ts`, agregar el import de `SegmentLayout`:

```typescript
import { Phrase, ImageItem, VideoRecord, VideoConfig, VideoMeta, SegmentLayout } from '../types'
```

Al final del archivo, agregar:

```typescript
export interface ComposedImageOutput {
  type: 'single' | 'combined' | 'hook' | 'punchline'
  label: string
  filename: string
  publicUrl: string
  localPath: string
}

export const composerApi = {
  generateImage: (params: {
    config: VideoConfig
    format: 'jpeg' | 'png'
    quality: number
    hookLayouts?: SegmentLayout[]
    hookLines?: string[]
    punchlineLayouts?: SegmentLayout[]
    punchlineLines?: string[]
  }) =>
    api
      .post<{ success: boolean; images: ComposedImageOutput[] }>('/compose/image', params)
      .then((r) => r.data),

  uploadToDrive: (localPath: string, filename: string) =>
    api
      .post<{ driveUrl: string }>('/compose/image-drive', { localPath, filename })
      .then((r) => r.data),
}
```

---

## Task 11: computeLayoutsFor + computeImageLayouts en Editor.tsx

**Files:**
- Modificar: `client/src/pages/Editor.tsx`

Contexto: La función `computeSegmentLayouts` actual en `Editor.tsx` computa los layouts del texto usando `canvas.measureText`. Vamos a extraer su lógica en una función reutilizable `computeLayoutsFor(textContent, yPercent)` y luego `computeImageLayouts()` la usará con el texto partido por `//`.

- [ ] **Paso 1: Extraer computeLayoutsFor como función interna**

Dentro del componente `Editor`, ANTES de `computeSegmentLayouts`, agregar la función helper:

```typescript
const computeLayoutsFor = (textContent: string, yPercent: number) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const { text, resolution } = config
  const W = resolution.width
  const H = resolution.height

  const fontName = text.font.replace(/'/g, '').split(',')[0].trim()
  const weightStr = text.fontWeight === 800 ? '800' : '400'
  const styleStr = text.fontStyle === 'italic' ? 'italic ' : ''
  ctx.font = `${styleStr}${weightStr} ${text.fontSize}px "${fontName}", sans-serif`.trim()

  const maxPx = Math.round((Math.min(text.maxWidth, 85) / 100) * W)
  const x = Math.round((text.position.x / 100) * W)
  const y = Math.round((yPercent / 100) * H)

  const cleanContent = textContent.replace(/\s*\/\/\s*/g, ' ')
  const parts = cleanContent.split(/(\[[^\]]+\]|\[[^\]]*$)/g)
  const segments = parts.map((part) => {
    if (part.startsWith('[')) {
      const isClosed = part.endsWith(']')
      const rawContent = part.slice(1, isClosed ? -1 : undefined)
      const [content, customColor] = rawContent.split('|')
      return { text: content, styled: true, color: customColor || text.highlightColor }
    }
    return { text: part, styled: false, color: text.color }
  }).filter((p) => p.text.length > 0)

  const flatText = segments.map((s) => s.text).join('')
  const words = flatText.split(' ')
  const lines: string[] = []
  let current = ''
  const measureSafe = (txt: string) => ctx.measureText(txt).width * 1.15

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (measureSafe(test) > maxPx && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  const lineH = text.fontSize * text.lineHeight
  const totalH = lines.length * lineH
  const startY = y - totalH / 2 + lineH / 2

  const segmentLayouts: any[] = []
  let charIndex = 0

  lines.forEach((line, lineIdx) => {
    const lineY = startY + lineIdx * lineH
    let totalLineWidth = 0
    const segmentsInLine: { text: string; color: string; isStyled: boolean }[] = []

    let lineOffset = 0
    while (lineOffset < line.length) {
      const globalCharIdx = charIndex + lineOffset
      let currentSegColor = text.color
      let currentIsStyled = false
      let segOffset = 0
      for (const seg of segments) {
        if (globalCharIdx >= segOffset && globalCharIdx < segOffset + seg.text.length) {
          currentSegColor = seg.color
          currentIsStyled = seg.styled
          break
        }
        segOffset += seg.text.length
      }

      let segLength = 0
      while (lineOffset + segLength < line.length) {
        const testGlobalIdx = globalCharIdx + segLength
        let nextSegColor = text.color
        let nextIsStyled = false
        let nextSegOffset = 0
        for (const seg of segments) {
          if (testGlobalIdx >= nextSegOffset && testGlobalIdx < nextSegOffset + seg.text.length) {
            nextSegColor = seg.color
            nextIsStyled = seg.styled
            break
          }
          nextSegOffset += seg.text.length
        }
        if (nextSegColor === currentSegColor && nextIsStyled === currentIsStyled) {
          segLength++
        } else {
          break
        }
      }

      const segmentText = line.substring(lineOffset, lineOffset + segLength)
      segmentsInLine.push({ text: segmentText, color: currentSegColor, isStyled: currentIsStyled })

      ctx.font = currentIsStyled
        ? `${styleStr}800 ${text.fontSize}px "${fontName}", sans-serif`
        : `${styleStr}${weightStr} ${text.fontSize}px "${fontName}", sans-serif`
      totalLineWidth += measureSafe(segmentText)
      lineOffset += segLength
    }

    let drawX = text.align === 'center'
      ? x - Math.round(totalLineWidth / 2)
      : text.align === 'right'
      ? x - Math.round(totalLineWidth)
      : x

    for (const seg of segmentsInLine) {
      ctx.font = seg.isStyled
        ? `${styleStr}800 ${text.fontSize}px "${fontName}", sans-serif`
        : `${styleStr}${weightStr} ${text.fontSize}px "${fontName}", sans-serif`
      const segW = measureSafe(seg.text)
      segmentLayouts.push({
        text: seg.text,
        x: drawX,
        y: lineY,
        color: seg.color,
        w: Math.round(segW),
        lineW: Math.round(totalLineWidth),
      })
      drawX += segW
    }

    charIndex += line.length
    if (lineIdx < lines.length - 1) charIndex += 1
  })

  return { wrappedLines: lines, segmentLayouts }
}
```

- [ ] **Paso 2: Simplificar computeSegmentLayouts para usar computeLayoutsFor**

Reemplazar `computeSegmentLayouts` por:

```typescript
const computeSegmentLayouts = () => {
  const { wrappedLines, segmentLayouts: rawLayouts } = computeLayoutsFor(
    config.text.content,
    config.text.position.y
  )

  const hasSplit = config.text.content.includes('//')
  const splitIndex = config.text.content.indexOf('//')
  const cleanSplitIndex = splitIndex !== -1
    ? config.text.content.substring(0, splitIndex).replace(/\[[^\]]+\]/g, (m) => m.slice(1, -1).split('|')[0]).length
    : -1

  const segmentLayouts = rawLayouts.map((seg: any, _i: number) => {
    const charPos = rawLayouts.slice(0, rawLayouts.indexOf(seg)).reduce((acc: number, s: any) => acc + s.text.length, 0)
    const phase = (cleanSplitIndex !== -1 && charPos >= cleanSplitIndex) ? 2 : 1
    return { ...seg, phase }
  })

  return { wrappedLines, segmentLayouts }
}
```

- [ ] **Paso 3: Agregar computeImageLayouts**

Después de `computeSegmentLayouts`, agregar:

```typescript
const computeImageLayouts = () => {
  const hasSplit = config.text.content.includes('//')
  if (!hasSplit) {
    const { wrappedLines, segmentLayouts } = computeLayoutsFor(
      config.text.content,
      config.text.position.y
    )
    return { hasSplit: false as const, wrappedLines, segmentLayouts }
  }

  const [ganchoRaw, remateRaw] = config.text.content.split('//')
  const hook = computeLayoutsFor(ganchoRaw.trim(), 35)
  const punchline = computeLayoutsFor(remateRaw.trim(), 70)

  return {
    hasSplit: true as const,
    hook,
    punchline,
    combined: {
      wrappedLines: [...hook.wrappedLines, ...punchline.wrappedLines],
      segmentLayouts: [...hook.segmentLayouts, ...punchline.segmentLayouts],
    },
  }
}
```

---

## Task 12: ImageResult.tsx — componente de resultados

**Files:**
- Crear: `client/src/components/ImageResult/ImageResult.tsx`

- [ ] **Paso 1: Crear el componente**

Crear `client/src/components/ImageResult/ImageResult.tsx`:

```tsx
import { useState } from 'react'
import { Download, HardDrive, ExternalLink } from 'lucide-react'
import { ComposedImageOutput, composerApi } from '../../api'

interface Props {
  images: ComposedImageOutput[]
  onToast: (msg: string, type: 'success' | 'error') => void
}

export default function ImageResult({ images, onToast }: Props) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [driveUrls, setDriveUrls] = useState<Record<string, string>>({})

  const uploadToDrive = async (img: ComposedImageOutput) => {
    setUploading(img.type)
    try {
      const { driveUrl } = await composerApi.uploadToDrive(img.localPath, img.filename)
      setDriveUrls((prev) => ({ ...prev, [img.type]: driveUrl }))
      onToast('Subido a Drive correctamente', 'success')
    } catch (e: any) {
      onToast('Error al subir a Drive: ' + e.message, 'error')
    } finally {
      setUploading(null)
    }
  }

  const combined = images.find((i) => i.type === 'combined')
  const single = images.find((i) => i.type === 'single')
  const hook = images.find((i) => i.type === 'hook')
  const punchline = images.find((i) => i.type === 'punchline')
  const hasSplit = !!(hook && punchline)

  const ImageCard = ({ img }: { img: ComposedImageOutput }) => (
    <div className="flex flex-col gap-2 p-3 bg-spirit-dark/50 border border-spirit-border rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-spirit-text">{img.label}</span>
        <span className="text-[10px] text-spirit-muted uppercase">{img.filename.split('.').pop()}</span>
      </div>

      <a href={img.publicUrl} target="_blank" rel="noreferrer">
        <img
          src={img.publicUrl}
          alt={img.label}
          className="w-full rounded-lg object-cover border border-spirit-border/30 hover:opacity-90 transition-opacity"
          style={{ aspectRatio: '9/16', maxHeight: '200px', objectFit: 'cover' }}
        />
      </a>

      <div className="flex gap-1.5">
        <a
          href={img.publicUrl}
          download={img.filename}
          className="flex-1 flex items-center justify-center gap-1.5 bg-spirit-card hover:bg-spirit-border border border-spirit-border text-white rounded-lg py-2 transition-colors text-xs font-medium"
        >
          <Download size={12} /> Descargar
        </a>

        {driveUrls[img.type] ? (
          <a
            href={driveUrls[img.type]}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 rounded-lg px-3 py-2 transition-colors text-xs font-medium"
          >
            <ExternalLink size={12} /> Drive
          </a>
        ) : (
          <button
            onClick={() => uploadToDrive(img)}
            disabled={uploading === img.type}
            className="flex items-center justify-center gap-1 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-2 transition-colors text-xs font-medium"
          >
            <HardDrive size={12} />
            {uploading === img.type ? '...' : 'Drive'}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="w-full flex flex-col gap-3 animate-fadeInUp">
      <p className="text-xs font-semibold text-spirit-accent uppercase tracking-widest">
        {hasSplit ? '3 imágenes generadas' : 'Imagen generada'}
      </p>

      {single && <ImageCard img={single} />}
      {combined && <ImageCard img={combined} />}

      {hasSplit && hook && punchline && (
        <div className="grid grid-cols-2 gap-2">
          <ImageCard img={hook} />
          <ImageCard img={punchline} />
        </div>
      )}
    </div>
  )
}
```

---

## Task 13: Editor.tsx — modo toggle + generateImage + wiring completo

**Files:**
- Modificar: `client/src/pages/Editor.tsx`

Este es el task de ensamblaje final. Reemplazar `Editor.tsx` completo con la versión integrada:

- [ ] **Paso 1: Actualizar imports en Editor.tsx**

```typescript
import { useState } from 'react'
import { Wand2, Send, RotateCcw, HardDrive } from 'lucide-react'
import VideoPreview from '../components/Preview/VideoPreview'
import VideoEditor from '../components/VideoEditor/VideoEditor'
import ImageBank from '../components/ImageBank/ImageBank'
import PhraseBank from '../components/PhraseBank/PhraseBank'
import ImageResult from '../components/ImageResult/ImageResult'
import ToastContainer from '../components/Toast/Toast'
import { useVideoStore } from '../store/videoStore'
import { videosApi, composerApi, ComposedImageOutput } from '../api'
import { VideoRecord } from '../types'
import { useToast } from '../hooks/useToast'
```

- [ ] **Paso 2: Agregar estado de imagen y toast al componente**

Dentro del componente `Editor`, reemplazar el bloque de estado:

```typescript
const { config, meta, selectedPhraseId, setMeta, isGenerating, setGenerating, reset, mode, setMode, imageFormat, imageQuality } = useVideoStore()
const [tab, setTab] = useState<Tab>('editor')
const [lastVideo, setLastVideo] = useState<VideoRecord | null>(null)
const [lastImages, setLastImages] = useState<ComposedImageOutput[] | null>(null)
const [error, setError] = useState<string | null>(null)
const [renderProgress, setRenderProgress] = useState<number | null>(null)
const { toasts, toast } = useToast()
```

- [ ] **Paso 3: Agregar función generateImage**

Después de la función `generate`, agregar:

```typescript
const generateImage = async () => {
  if (!config.imageId) {
    toast.error('Selecciona una imagen primero')
    return
  }
  setError(null)
  setGenerating(true)
  setLastImages(null)
  try {
    const imageLayouts = computeImageLayouts()

    const params = imageLayouts.hasSplit
      ? {
          config,
          format: imageFormat,
          quality: imageQuality,
          hookLayouts: imageLayouts.hook.segmentLayouts,
          hookLines: imageLayouts.hook.wrappedLines,
          punchlineLayouts: imageLayouts.punchline.segmentLayouts,
          punchlineLines: imageLayouts.punchline.wrappedLines,
        }
      : {
          config: { ...config, segmentLayouts: imageLayouts.segmentLayouts, wrappedLines: imageLayouts.wrappedLines },
          format: imageFormat,
          quality: imageQuality,
        }

    const { images } = await composerApi.generateImage(params)
    setLastImages(images)
    toast.success('Imagen generada correctamente')
  } catch (e: any) {
    toast.error(e.response?.data?.error || e.message)
  } finally {
    setGenerating(false)
  }
}
```

- [ ] **Paso 4: Reemplazar uploadToDrive y publish para usar toast**

```typescript
const uploadToDrive = async () => {
  if (!lastVideo) return
  try {
    const { driveUrl } = await videosApi.uploadToDrive(lastVideo.id)
    setLastVideo({ ...lastVideo, driveUrl })
    toast.success('Subido a Google Drive correctamente')
  } catch (e: any) {
    toast.error('Error al subir a Drive: ' + (e.response?.data?.error || e.message))
  }
}

const publish = async (env: 'test' | 'prod') => {
  if (!lastVideo) return
  try {
    await videosApi.publish(lastVideo.id, env)
    toast.success(`Enviado al webhook de ${env}`)
  } catch (e: any) {
    toast.error('Error al publicar: ' + e.message)
  }
}
```

- [ ] **Paso 5: Agregar toggle de modo en el sidebar (debajo del logo, antes de los tabs)**

En el JSX del `<aside>`, después del div del logo y antes del div de tabs:

```tsx
{/* Toggle Video / Imagen */}
<div className="flex mx-4 my-3 rounded-xl border border-spirit-border bg-spirit-dark overflow-hidden">
  <button
    onClick={() => { setMode('video'); setLastImages(null) }}
    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${
      mode === 'video'
        ? 'bg-spirit-accent text-white'
        : 'text-spirit-muted hover:text-white'
    }`}
  >
    🎬 Video
  </button>
  <button
    onClick={() => { setMode('image'); setLastVideo(null) }}
    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all ${
      mode === 'image'
        ? 'bg-spirit-accent text-white'
        : 'text-spirit-muted hover:text-white'
    }`}
  >
    🖼️ Imagen
  </button>
</div>
```

- [ ] **Paso 6: Reemplazar el panel de acciones (derecha) para soportar ambos modos**

Reemplazar el bloque `{/* Acciones (Panel lateral derecho) */}` completo:

```tsx
{/* Acciones */}
<div className="flex flex-col gap-4 w-72 shrink-0">

  {/* Botón principal */}
  <div className="flex gap-2 w-full">
    <button
      onClick={mode === 'video' ? generate : generateImage}
      disabled={isGenerating}
      className="flex-1 flex items-center justify-center gap-2 bg-spirit-accent hover:bg-spirit-accent-light disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3.5 transition-all glow-accent relative overflow-hidden text-sm"
    >
      <Wand2 size={16} className={isGenerating ? 'animate-spin' : ''} />
      {isGenerating
        ? mode === 'video' ? `${renderProgress ?? 0}%` : 'Generando...'
        : mode === 'video' ? 'Generar video' : 'Generar imagen'
      }
      {renderProgress !== null && mode === 'video' && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-white/50 transition-all duration-300"
          style={{ width: `${renderProgress}%` }}
        />
      )}
    </button>

    <button
      onClick={reset}
      className="flex items-center justify-center bg-spirit-card border border-spirit-border hover:bg-spirit-border text-spirit-muted hover:text-white rounded-xl px-4 transition-colors shrink-0"
      title="Reiniciar configuraciones"
    >
      <RotateCcw size={16} />
    </button>
  </div>

  {/* Resultado video */}
  {mode === 'video' && lastVideo && (
    <div className="w-full flex flex-col gap-3 p-4 bg-spirit-dark/50 border border-spirit-border rounded-xl animate-fadeInUp">
      <a
        href={lastVideo.publicUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl px-4 py-3 transition-colors text-sm shadow-lg shadow-purple-900/20 w-full"
      >
        Ver en navegador ↗
      </a>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <button
          onClick={uploadToDrive}
          className="flex items-center justify-center gap-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 rounded-lg px-2 py-2 transition-colors text-xs font-medium col-span-1"
        >
          <HardDrive size={13} /> Drive
        </button>
        <button
          onClick={() => publish('test')}
          className="flex items-center justify-center gap-1.5 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-700/40 text-yellow-300 rounded-lg px-2 py-2 transition-colors text-xs font-medium"
        >
          <Send size={13} /> Test
        </button>
        <button
          onClick={() => publish('prod')}
          className="flex items-center justify-center gap-1.5 bg-green-900/30 hover:bg-green-900/50 border border-green-700/40 text-green-300 rounded-lg px-2 py-2 transition-colors text-xs font-medium"
        >
          <Send size={13} /> Prod
        </button>
      </div>
    </div>
  )}

  {/* Resultado imágenes */}
  {mode === 'image' && lastImages && (
    <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
      <ImageResult
        images={lastImages}
        onToast={(msg, type) => type === 'success' ? toast.success(msg) : toast.error(msg)}
      />
    </div>
  )}

  {error && (
    <p className="text-center text-red-400 text-sm animate-fadeInUp">{error}</p>
  )}
</div>
```

- [ ] **Paso 7: Agregar ToastContainer al final del return del componente, antes del `</div>` de cierre**

```tsx
<ToastContainer toasts={toasts} />
```

---

## Task 14: .env.example + Obsidian memory

**Files:**
- Modificar: `.env.example`

- [ ] **Paso 1: Agregar variables a .env.example**

Agregar al final del archivo:

```
# ─── Frontend ─────────────────────────────────────────────
# URL base del servidor (para watermark preview en modo desarrollo)
VITE_API_URL=http://localhost:3001

# ─── Imágenes generadas ───────────────────────────────────
OUTPUT_IMAGES_PATH=./output-images
```

- [ ] **Paso 2: Guardar memoria del proceso en Obsidian**

Invocar el skill `/save` de Obsidian con el resumen de esta sesión:
- App: OrganicIntelligences v2
- Features: Modo imagen (B+C), secciones colapsables, toasts, fix watermark, quitar S3
- Spec: `docs/superpowers/specs/2026-05-05-organic-intelligences-v2-design.md`
- Plan: `docs/superpowers/plans/2026-05-05-organic-intelligences-v2.md`
- Estado: plan listo para ejecutar

---

## Self-Review del plan

### Cobertura del spec
- [x] Backup → Task 1
- [x] `mode`, `imageFormat`, `imageQuality` en store → Task 2
- [x] Toast notifications → Task 3
- [x] Secciones colapsables + modo-aware → Task 4
- [x] Fix watermark URL → Task 5
- [x] Quitar S3 → Task 6
- [x] `imageGenerator.ts` → Task 7
- [x] `config.paths.outputImages` + ruta estática → Task 8
- [x] `POST /api/compose/image` + Drive → Task 9
- [x] `composerApi` en cliente → Task 10
- [x] `computeLayoutsFor` + `computeImageLayouts` → Task 11
- [x] `ImageResult.tsx` → Task 12
- [x] Editor.tsx wiring completo → Task 13
- [x] `.env.example` + Obsidian → Task 14

### Consistencia de tipos
- `SegmentLayout` usado en Tasks 7, 9, 10, 11 — mismo tipo de `client/src/types/index.ts`
- `ComposedImageOutput` definido en Task 10 (api/index.ts), importado en Tasks 12 y 13
- `computeLayoutsFor` retorna `{ wrappedLines, segmentLayouts }` — consumido correctamente en Tasks 11 y 13
- `composerApi.generateImage` acepta `hookLayouts?: SegmentLayout[]` — alineado con `compose.ts`
- `imageGenerator.ts` usa `config.paths.outputImages` definido en Task 8

### Sin placeholders
Revisado: ningún paso contiene TBD, TODO, o código incompleto.
