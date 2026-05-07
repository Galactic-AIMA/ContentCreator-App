import { useEffect, useState, useCallback } from 'react'
import {
  ChevronDown, ChevronUp, Trash2, Pencil,
  X, Check, Sparkles, Wand2, CheckSquare, Square,
} from 'lucide-react'
import { phrasesApi } from '../../api'
import { Phrase } from '../../types'
import { useVideoStore } from '../../store/videoStore'

const CATEGORIES = ['Sincronía Natural', 'Sabiduría del Cuerpo', 'Ritmo Vital'] as const
type Category = typeof CATEGORIES[number]

const CAT_CHIP: Record<Category, string> = {
  'Sincronía Natural':    'bg-violet-500/20 text-violet-300 border-violet-500/30',
  'Sabiduría del Cuerpo': 'bg-cyan-500/20   text-cyan-300   border-cyan-500/30',
  'Ritmo Vital':          'bg-amber-500/20  text-amber-300  border-amber-500/30',
}
const CAT_DOT: Record<Category, string> = {
  'Sincronía Natural':    'bg-violet-400',
  'Sabiduría del Cuerpo': 'bg-cyan-400',
  'Ritmo Vital':          'bg-amber-400',
}
const CAT_SHORT: Record<Category, string> = {
  'Sincronía Natural':    'Sincronía',
  'Sabiduría del Cuerpo': 'Sabiduría',
  'Ritmo Vital':          'Ritmo',
}

function parsePastedText(raw: string): string[] {
  const text = raw.trim()
  const numbered = text.split(/\n+/).filter((l) => /^\d+[\.\)]\s+/.test(l.trim()))
  if (numbered.length > 1) return numbered.map((l) => l.replace(/^\d+[\.\)]\s+/, '').trim()).filter(Boolean)
  const byParagraph = text.split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean)
  if (byParagraph.length > 1) return byParagraph
  const byBullet = text.split(/\n+/).filter((l) => /^[-*•]\s+/.test(l.trim()))
  if (byBullet.length > 1) return byBullet.map((l) => l.replace(/^[-*•]\s+/, '').trim()).filter(Boolean)
  const byLine = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  if (byLine.length > 1) return byLine
  return text ? [text] : []
}

type Block = 'inventory' | 'import' | 'ai'

export default function PhraseBank() {
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [pairsStats, setPairsStats] = useState<Record<string, { pairsRemaining: number }>>({})
  const [totalImages, setTotalImages] = useState(0)

  // Accordion
  const [openBlock, setOpenBlock] = useState<Block | null>('inventory')

  // Bloque A
  const [filterCat, setFilterCat] = useState<Category | 'Todas'>('Todas')
  const [filterStatus, setFilterStatus] = useState<'active' | 'pending'>('active')
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [generatingMeta, setGeneratingMeta] = useState(false)

  // Bloque B
  const [importText, setImportText] = useState('')
  const [importCat, setImportCat] = useState<Category>('Sincronía Natural')
  const [importPreview, setImportPreview] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<number | null>(null)

  // Bloque C
  const [aiCat, setAiCat] = useState<Category>('Sincronía Natural')
  const [aiCount, setAiCount] = useState(8)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiPending, setAiPending] = useState<Phrase[]>([])
  const [aiSelected, setAiSelected] = useState<Set<string>>(new Set())
  const [approving, setApproving] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const { config, setText, setMeta, setSelectedPhraseId } = useVideoStore()

  const load = useCallback(async () => {
    const [data, statsData] = await Promise.all([
      phrasesApi.list(),
      phrasesApi.pairsStats(),
    ])
    setPhrases(data)
    setPairsStats(statsData.stats)
    setTotalImages(statsData.totalImages)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setImportPreview(importText.trim() ? parsePastedText(importText) : [])
  }, [importText])

  // ── Bloque A helpers ──
  const selectPhrase = (phrase: Phrase) => {
    setText({ content: phrase.text })
    setSelectedPhraseId(phrase.id)
  }

  const generateMeta = async () => {
    if (!config.text.content) return
    setGeneratingMeta(true)
    try {
      const meta = await phrasesApi.generateMeta(config.text.content)
      setMeta({ title: meta.title, description: meta.description, tags: meta.tags })
    } finally {
      setGeneratingMeta(false)
    }
  }

  const startEdit = (phrase: Phrase) => { setEditId(phrase.id); setEditText(phrase.text) }
  const cancelEdit = () => { setEditId(null); setEditText('') }

  const saveEdit = async () => {
    if (!editId) return
    await phrasesApi.update(editId, { text: editText })
    cancelEdit()
    load()
  }

  const deletePhrase = async (id: string) => {
    await phrasesApi.remove(id)
    load()
  }

  // ── Bloque B helpers ──
  const handleBulkImport = async () => {
    if (!importPreview.length) return
    setImporting(true)
    try {
      await phrasesApi.bulkCreate(importPreview, importCat)
      setImportSuccess(importPreview.length)
      setImportText('')
      setTimeout(() => setImportSuccess(null), 3000)
      load()
    } finally {
      setImporting(false)
    }
  }

  // ── Bloque C helpers ──
  const handleGenerateAI = async () => {
    setAiGenerating(true)
    setAiError(null)
    setAiPending([])
    setAiSelected(new Set())
    try {
      const generated = await phrasesApi.generateAI(aiCat, aiCount)
      setAiPending(generated)
      setAiSelected(new Set(generated.map((p) => p.id)))
    } catch (e: any) {
      setAiError(e.response?.data?.error || e.message || 'Error generando frases')
    } finally {
      setAiGenerating(false)
    }
  }

  const toggleAiSelect = (id: string) =>
    setAiSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleApprove = async () => {
    if (!aiSelected.size) return
    setApproving(true)
    try {
      const approveIds = [...aiSelected]
      const discardIds = aiPending.filter((p) => !aiSelected.has(p.id)).map((p) => p.id)
      await phrasesApi.approve(approveIds, discardIds)
      setAiPending([])
      setAiSelected(new Set())
      await load()
      // Navegar al inventario para que el usuario vea las frases aprobadas
      setFilterStatus('active')
      setOpenBlock('inventory')
    } finally {
      setApproving(false)
    }
  }

  const discardAll = () => { setAiPending([]); setAiSelected(new Set()) }

  // ── Datos filtrados ──
  const pendingCount = phrases.filter((p) => p.status === 'pending').length
  const visible = phrases.filter((p) => {
    const statusOk = (p.status ?? 'active') === filterStatus
    const catOk = filterCat === 'Todas' || p.category === filterCat
    return statusOk && catOk
  })

  const toggle = (b: Block) => setOpenBlock((prev) => (prev === b ? null : b))

  // ── Header de bloque ──
  const BlockHeader = ({ id, label, badge }: { id: Block; label: string; badge?: number }) => (
    <button
      onClick={() => toggle(id)}
      className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
    >
      <span className="flex items-center gap-2">
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="text-[10px] bg-brand-500/30 text-brand-300 rounded-full px-2 py-0.5 font-medium">
            {badge}
          </span>
        )}
      </span>
      {openBlock === id
        ? <ChevronUp size={14} className="text-gray-500 shrink-0" />
        : <ChevronDown size={14} className="text-gray-500 shrink-0" />}
    </button>
  )

  // ── Selector de categoría reutilizable ──
  const CategorySelector = ({ value, onChange }: { value: Category; onChange: (c: Category) => void }) => (
    <div className="flex flex-col gap-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all text-left ${
            value === cat
              ? 'border-brand-500 bg-brand-500/10 text-white'
              : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${CAT_DOT[cat]}`} />
          {cat}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col divide-y divide-spirit-border">

      {/* ════════════════════════════════════════
          BLOQUE A — Inventario
      ════════════════════════════════════════ */}
      <div>
        <BlockHeader id="inventory" label="Inventario" badge={visible.length} />

        {openBlock === 'inventory' && (
          <div className="flex flex-col gap-3 p-4 pt-1">

            {/* Pills de categoría */}
            <div className="flex flex-wrap gap-1">
              {(['Todas', ...CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    filterCat === cat
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {cat === 'Todas' ? 'Todas' : CAT_SHORT[cat]}
                </button>
              ))}
            </div>

            {/* Toggle activas / pendientes */}
            <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
              <button
                onClick={() => setFilterStatus('active')}
                className={`flex-1 py-1.5 font-medium transition-colors ${
                  filterStatus === 'active' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Activas
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`flex-1 py-1.5 font-medium transition-colors relative ${
                  filterStatus === 'pending' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Pendientes
                {pendingCount > 0 && (
                  <span className="absolute -top-1 right-1 text-[9px] bg-amber-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>

            {/* Botón generar meta */}
            <button
              onClick={generateMeta}
              disabled={generatingMeta}
              className="flex items-center justify-center gap-1.5 text-xs bg-brand-500/20 hover:bg-brand-500/30 disabled:opacity-50 border border-brand-500/40 text-brand-300 rounded-lg px-3 py-2 transition-colors w-full"
            >
              <Sparkles size={12} />
              {generatingMeta ? 'Generando...' : 'Generar título, descripción y tags'}
            </button>

            {/* Lista de frases */}
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {visible.map((phrase) => {
                const stats = pairsStats[phrase.id]
                const isEditing = editId === phrase.id

                return (
                  <div
                    key={phrase.id}
                    onClick={() => !isEditing && selectPhrase(phrase)}
                    className="group flex flex-col gap-1.5 bg-gray-800/80 hover:bg-gray-800 rounded-lg p-2.5 cursor-pointer transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          className="w-full bg-gray-700 border border-yellow-400 rounded p-1.5 text-xs text-white resize-none focus:outline-none"
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            className="flex items-center gap-1 text-xs bg-yellow-500 hover:bg-yellow-400 text-white rounded px-2 py-1"
                          >
                            <Check size={11} /> Guardar
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center gap-1 text-xs bg-gray-700 text-gray-300 rounded px-2 py-1"
                          >
                            <X size={11} /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-200 leading-relaxed line-clamp-2">{phrase.text}</p>

                        <div className="flex items-center justify-between gap-1">
                          {/* Chips izquierda */}
                          <div className="flex items-center gap-1 min-w-0 flex-wrap">
                            {phrase.category && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${CAT_CHIP[phrase.category as Category] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                                {CAT_SHORT[phrase.category as Category] ?? phrase.category}
                              </span>
                            )}
                            {(phrase.usageCount ?? 0) > 0 && (
                              <span className="text-[10px] text-brand-400 bg-brand-500/20 rounded px-1.5 py-0.5 shrink-0">
                                ×{phrase.usageCount}
                              </span>
                            )}
                            {stats && totalImages > 0 && (
                              <span className={`text-[10px] rounded px-1.5 py-0.5 shrink-0 ${
                                stats.pairsRemaining === 0
                                  ? 'text-red-400 bg-red-900/20'
                                  : 'text-gray-500'
                              }`}>
                                {stats.pairsRemaining}/{totalImages}
                              </span>
                            )}
                          </div>

                          {/* Acciones derecha */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); selectPhrase(phrase) }}
                              className="text-[10px] bg-brand-500/30 hover:bg-brand-500/50 text-brand-300 rounded px-1.5 py-0.5 font-medium"
                            >
                              Usar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(phrase) }}
                              className="text-gray-400 hover:text-white p-0.5 transition-colors"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deletePhrase(phrase.id) }}
                              className="text-gray-400 hover:text-red-400 p-0.5 transition-colors"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {visible.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">
                  {filterStatus === 'pending'
                    ? 'No hay frases pendientes de aprobación.'
                    : 'No hay frases. Importa una lista o genera con IA.'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          BLOQUE B — Importar lista
      ════════════════════════════════════════ */}
      <div>
        <BlockHeader id="import" label="Importar lista" />

        {openBlock === 'import' && (
          <div className="flex flex-col gap-3 p-4 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Categoría del lote</label>
              <CategorySelector value={importCat} onChange={setImportCat} />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1.5">
                Pega frases. Se detectan separadores automáticamente (líneas, números, guiones).
              </p>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs text-white resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"1. Cuando lloras sin saber por qué // tu cuerpo está procesando\n2. El cansancio no es pereza // es tu sistema nervioso"}
              />
            </div>

            {importPreview.length > 0 && (
              <p className="text-xs text-green-400 font-medium">
                {importPreview.length} frase{importPreview.length !== 1 ? 's' : ''} detectada{importPreview.length !== 1 ? 's' : ''}
              </p>
            )}
            {importSuccess !== null && (
              <p className="text-xs text-green-400 font-medium">✓ {importSuccess} frases importadas</p>
            )}

            <button
              onClick={handleBulkImport}
              disabled={!importPreview.length || importing}
              className="flex items-center justify-center gap-1.5 text-xs bg-brand-500 hover:bg-brand-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-colors font-medium"
            >
              <Check size={13} />
              {importing ? 'Importando...' : `Agregar ${importPreview.length || '0'} frases`}
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          BLOQUE C — Generar con IA
      ════════════════════════════════════════ */}
      <div>
        <BlockHeader id="ai" label="Generar con IA" />

        {openBlock === 'ai' && (
          <div className="flex flex-col gap-3 p-4 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Categoría objetivo</label>
              <CategorySelector value={aiCat} onChange={setAiCat} />
            </div>

            {/* Slider */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">
                Cantidad: <span className="text-white font-semibold">{aiCount}</span>
              </label>
              <input
                type="range"
                min={5}
                max={15}
                step={1}
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>5</span><span>15</span>
              </div>
            </div>

            <button
              onClick={handleGenerateAI}
              disabled={aiGenerating}
              className="flex items-center justify-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2.5 font-medium transition-colors"
            >
              <Wand2 size={13} className={aiGenerating ? 'animate-spin' : ''} />
              {aiGenerating ? 'Generando con Gemini...' : `Generar ${aiCount} frases`}
            </button>

            {aiError && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
                {aiError}
              </p>
            )}

            {/* Lista de frases pendientes con checkboxes */}
            {aiPending.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-amber-300">{aiPending.length} frases para revisar</p>
                  <button
                    onClick={() => setAiSelected(
                      aiSelected.size === aiPending.length
                        ? new Set()
                        : new Set(aiPending.map((p) => p.id))
                    )}
                    className="text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {aiSelected.size === aiPending.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                  {aiPending.map((phrase) => (
                    <div
                      key={phrase.id}
                      onClick={() => toggleAiSelect(phrase.id)}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        aiSelected.has(phrase.id)
                          ? 'border-green-500/50 bg-green-900/20'
                          : 'border-gray-700/50 bg-gray-800/30 opacity-50'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {aiSelected.has(phrase.id)
                          ? <CheckSquare size={13} className="text-green-400" />
                          : <Square size={13} className="text-gray-600" />}
                      </span>
                      <p className="text-xs text-gray-200 leading-relaxed">{phrase.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={!aiSelected.size || approving}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 font-medium transition-colors"
                  >
                    <Check size={12} />
                    {approving ? 'Aprobando...' : `Aprobar ${aiSelected.size}`}
                  </button>
                  <button
                    onClick={discardAll}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg px-3 py-2 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
