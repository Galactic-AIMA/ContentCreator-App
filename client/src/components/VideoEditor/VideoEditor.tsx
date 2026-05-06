import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useVideoStore } from '../../store/videoStore'
import { TransitionType, VideoStyle, TextEffect } from '../../types'
import PresetManager from './PresetManager'

const FONTS = [
  { value: "'Inter', sans-serif", label: 'Inter' },
  { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue' },
  { value: "'Cinzel', serif", label: 'Cinzel' },
  { value: "'Lora', serif", label: 'Lora' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Oswald', sans-serif", label: 'Oswald' },
  { value: "'Outfit', sans-serif", label: 'Outfit' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'PT Serif', serif", label: 'PT Serif' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Roboto Slab', serif", label: 'Roboto Slab' },
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
]

const STYLES: { value: VideoStyle; label: string; emoji: string }[] = [
  { value: 'serene', label: 'Serene', emoji: '🌊' },
  { value: 'raw', label: 'Raw', emoji: '⚡' },
  { value: 'minimal', label: 'Minimal', emoji: '○' },
  { value: 'cinematic', label: 'Cinematic', emoji: '🎬' },
  { value: 'bold', label: 'Bold', emoji: '💥' },
]

const EFFECTS: { value: TextEffect; label: string; emoji: string }[] = [
  { value: 'none', label: 'Sin efecto', emoji: '—' },
  { value: 'fadeIn', label: 'Fade In', emoji: '🌅' },
  { value: 'typewriter', label: 'Typewriter', emoji: '⌨️' },
  { value: 'slideUp', label: 'Slide Up', emoji: '⬆️' },
  { value: 'scaleIn', label: 'Scale In', emoji: '🔍' },
  { value: 'glowPulse', label: 'Glow', emoji: '✨' },
]

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'fadeBlack', label: 'Fade desde negro' },
  { value: 'fade', label: 'Fade suave' },
  { value: 'none', label: 'Sin transición' },
]

const RESOLUTIONS = [
  { label: 'Reels / TikTok', ratio: '9:16', width: 1080, height: 1920 },
  { label: 'Post cuadrado', ratio: '1:1', width: 1080, height: 1080 },
  { label: 'Feed vertical', ratio: '4:5', width: 1080, height: 1350 },
  { label: 'Paisaje', ratio: '16:9', width: 1920, height: 1080 },
]

export default function VideoEditor() {
  const { config, setConfig, setText, mode, imageFormat, imageQuality, setImageExport } = useVideoStore()
  const { text, duration, transition, transitionDuration, style, textEffect, watermark, watermarkPosition, cinematicGrain } = config

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

      {/* ── Formato / Resolución ── */}
      <Section title="Formato" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5">
          {RESOLUTIONS.map((r) => {
            const active = config.resolution.width === r.width && config.resolution.height === r.height
            return (
              <button
                key={r.ratio}
                onClick={() => setConfig({ resolution: { width: r.width, height: r.height } })}
                className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg border text-[10px] font-medium transition-all ${
                  active
                    ? 'bg-spirit-accent/20 border-spirit-accent text-white shadow-md shadow-spirit-accent/20'
                    : 'bg-spirit-dark border-spirit-border text-spirit-muted hover:border-spirit-accent/40 hover:text-white'
                }`}
              >
                <span className="font-bold text-[11px]">{r.ratio}</span>
                <span className="opacity-70">{r.label}</span>
              </button>
            )
          })}
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

      {/* ── Presets ── */}
      <Section title="Presets" defaultOpen={false}>
        <PresetManager />
      </Section>

    </div>
  )
}

// Componente de sección colapsable para mantener el sidebar organizado
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
