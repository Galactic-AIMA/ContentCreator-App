import { useState } from 'react'
import { Save, Trash2, FolderOpen } from 'lucide-react'
import { useVideoStore } from '../../store/videoStore'
import { usePresets, VideoPreset } from '../../hooks/usePresets'

export default function PresetManager() {
  const { config, setConfig, setText } = useVideoStore()
  const { builtIn, userPresets, save, remove, getConfigPatch, getTextPatch } = usePresets()
  const [name, setName] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)

  const handleSave = () => {
    if (!name.trim()) return
    const preset = save(config, name)
    setName('')
    setSavedId(preset.id)
    setTimeout(() => setSavedId(null), 2000)
  }

  const handleLoad = (preset: VideoPreset) => {
    setConfig(getConfigPatch(preset))
    setText(getTextPatch(preset))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Guardar preset actual */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nombre del preset..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 bg-spirit-dark border border-spirit-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-spirit-muted focus:outline-none focus:border-spirit-accent transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
            savedId
              ? 'bg-green-600/30 border-green-500 text-green-300'
              : name.trim()
              ? 'bg-spirit-accent/20 border-spirit-accent text-white hover:bg-spirit-accent/30'
              : 'bg-spirit-dark border-spirit-border text-spirit-muted opacity-50 cursor-not-allowed'
          }`}
        >
          <Save size={11} />
          {savedId ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>

      {/* Presets de fábrica */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-widest text-spirit-muted font-semibold">Incluidos</p>
        {builtIn.map((preset) => (
          <PresetRow key={preset.id} preset={preset} onLoad={() => handleLoad(preset)} />
        ))}
      </div>

      {/* Presets del usuario */}
      {userPresets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[9px] uppercase tracking-widest text-spirit-muted font-semibold">Mis presets</p>
          {userPresets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              onLoad={() => handleLoad(preset)}
              onDelete={() => remove(preset.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PresetRow({
  preset,
  onLoad,
  onDelete,
}: {
  preset: VideoPreset
  onLoad: () => void
  onDelete?: () => void
}) {
  const shortRatio = preset.resolution.width === preset.resolution.height
    ? '1:1'
    : preset.resolution.width > preset.resolution.height
    ? '16:9'
    : preset.resolution.height / preset.resolution.width > 1.7
    ? '9:16'
    : '4:5'

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-spirit-dark/60 border border-spirit-border/40 rounded-lg group hover:border-spirit-border transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[9px] font-bold text-spirit-accent/70 bg-spirit-accent/10 px-1.5 py-0.5 rounded shrink-0">
          {shortRatio}
        </span>
        <span className="text-xs text-spirit-text truncate">{preset.name}</span>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={onLoad}
          className="flex items-center gap-1 text-[10px] text-spirit-accent hover:text-white border border-spirit-accent/30 hover:border-spirit-accent px-2 py-1 rounded transition-all"
          title="Cargar preset"
        >
          <FolderOpen size={9} /> Cargar
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center text-[10px] text-red-400/50 hover:text-red-400 border border-red-900/30 hover:border-red-500/50 px-1.5 py-1 rounded transition-all"
            title="Eliminar"
          >
            <Trash2 size={9} />
          </button>
        )}
      </div>
    </div>
  )
}
