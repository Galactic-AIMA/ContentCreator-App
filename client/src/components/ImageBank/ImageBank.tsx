import React, { useEffect, useState, useRef } from 'react'
import { Shuffle, Upload, Search, Download, CheckCircle2, Loader2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { imagesApi, UnsplashPhoto } from '../../api'
import { ImageItem } from '../../types'
import { useVideoStore } from '../../store/videoStore'

type Tab = 'banco' | 'unsplash' | 'pinterest'

export default function ImageBank() {
  const [tab, setTab] = useState<Tab>('banco')
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hideUsed, setHideUsed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { config, setConfig } = useVideoStore()

  // ── Unsplash state ──────────────────────────────────────
  const [query, setQuery] = useState('')
  const [unsplashResults, setUnsplashResults] = useState<UnsplashPhoto[]>([])
  const [unsplashLoading, setUnsplashLoading] = useState(false)
  const [unsplashError, setUnsplashError] = useState('')
  const [unsplashPage, setUnsplashPage] = useState(1)
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set())

  // ── Carpeta local eliminada ─────────────────────────

  // ── gallery-dl (Pinterest) state ─────────────────────────
  const [galleryDlUrl, setGalleryDlUrl] = useState('')
  const [galleryDlLoading, setGalleryDlLoading] = useState(false)
  const [galleryDlResult, setGalleryDlResult] = useState<{ downloaded: number; message: string } | null>(null)
  const [galleryDlError, setGalleryDlError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await imagesApi.list()
      setImages(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const selectImage = (img: ImageItem) => {
    setConfig({ imageId: img.id, imagePath: img.path, imagePreviewUrl: img.url })
  }

  const pickRandom = async () => {
    const img = await imagesApi.random()
    selectImage(img)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = await imagesApi.upload(file)
    await load()
    selectImage(img)
  }

  // ── Unsplash handlers ───────────────────────────────────
  const searchUnsplash = async (page = 1) => {
    if (!query.trim()) return
    setUnsplashLoading(true)
    setUnsplashError('')
    try {
      const results = await imagesApi.unsplashSearch(query.trim(), page)
      setUnsplashResults(results)
      setUnsplashPage(page)
    } catch (err: any) {
      setUnsplashError(err.response?.data?.error ?? err.message)
    } finally {
      setUnsplashLoading(false)
    }
  }

  const downloadPhoto = async (photo: UnsplashPhoto) => {
    if (downloading.has(photo.id) || downloaded.has(photo.id)) return
    setDownloading((s) => new Set(s).add(photo.id))
    try {
      const img = await imagesApi.unsplashDownload(photo.id, photo.regular, photo.photographer)
      await load()
      selectImage(img)
      setDownloaded((s) => new Set(s).add(photo.id))
    } catch (err: any) {
      setUnsplashError(err.response?.data?.error ?? err.message)
    } finally {
      setDownloading((s) => { const n = new Set(s); n.delete(photo.id); return n })
    }
  }

  // ── gallery-dl handler ──────────────────────────────────
  const handleGalleryDl = async () => {
    if (!galleryDlUrl.trim()) return
    setGalleryDlLoading(true)
    setGalleryDlError('')
    setGalleryDlResult(null)
    try {
      const result = await imagesApi.galleryDl(galleryDlUrl.trim())
      setGalleryDlResult(result)
      await load()
    } catch (err: any) {
      setGalleryDlError(err.response?.data?.error ?? err.message)
    } finally {
      setGalleryDlLoading(false)
    }
  }

  // ── Bulk import handler eliminado ─────────────────────────────────

  const hasUsed = images.some((img) => (img.usageCount ?? 0) > 0)
  const visible = hideUsed ? images.filter((img) => (img.usageCount ?? 0) === 0) : images

  const tabs: { id: Tab; label: string }[] = [
    { id: 'banco', label: 'Banco' },
    { id: 'unsplash', label: 'Unsplash' },
    { id: 'pinterest', label: 'Pinterest' },
  ]

  return (
    <div className="flex flex-col gap-0">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 px-3 pt-2 gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-1.5 rounded-t-md font-medium transition-colors ${
              tab === t.id
                ? 'bg-gray-800 text-white border border-b-0 border-gray-700'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Banco local ─────────────────────────────── */}
      {tab === 'banco' && (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex gap-2">
            <button
              onClick={pickRandom}
              className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 transition-colors"
            >
              <Shuffle size={13} /> Aleatoria
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 transition-colors"
            >
              <Upload size={13} /> Subir
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>

          {hasUsed && (
            <button
              onClick={() => setHideUsed(!hideUsed)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
            >
              {hideUsed ? '+ Mostrar todas' : '○ Ocultar usadas'}
            </button>
          )}

          {loading ? (
            <p className="text-xs text-gray-500">Cargando imágenes...</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {visible.map((img) => (
                <button
                  key={img.id}
                  onClick={() => selectImage(img)}
                  className={`relative aspect-[9/16] overflow-hidden rounded-lg border-2 transition-all ${
                    config.imageId === img.id
                      ? 'border-brand-500'
                      : 'border-transparent hover:border-gray-600'
                  }`}
                >
                  <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                  {(img.usageCount ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 text-xs bg-black/70 text-brand-400 rounded px-1 py-0.5 font-medium leading-none">
                      ×{img.usageCount}
                    </span>
                  )}
                </button>
              ))}
              {visible.length === 0 && (
                <p className="col-span-3 text-xs text-gray-500 text-center py-8">
                  No hay imágenes en el banco.
                  <br />
                  Sube una, importa una carpeta o busca en Unsplash.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Unsplash ─────────────────────────────────── */}
      {tab === 'unsplash' && (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUnsplash(1)}
              placeholder="nature, wellness, body..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <button
              onClick={() => searchUnsplash(1)}
              disabled={unsplashLoading || !query.trim()}
              className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg px-3 py-2 text-white transition-colors"
            >
              {unsplashLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            </button>
          </div>

          {unsplashError && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
              {unsplashError}
            </p>
          )}

          {unsplashResults.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {unsplashResults.map((photo) => {
                  const isDone = downloaded.has(photo.id)
                  const isLoading = downloading.has(photo.id)
                  return (
                    <button
                      key={photo.id}
                      onClick={() => downloadPhoto(photo)}
                      disabled={isDone || isLoading}
                      title={`${photo.description || photo.photographer} — clic para añadir al banco`}
                      className="relative aspect-[9/16] overflow-hidden rounded-lg border-2 border-transparent hover:border-brand-500 disabled:cursor-default transition-all group"
                    >
                      <img src={photo.thumb} alt={photo.description} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        {isDone ? (
                          <CheckCircle2 size={20} className="text-green-400 drop-shadow" />
                        ) : isLoading ? (
                          <Loader2 size={20} className="text-white animate-spin drop-shadow" />
                        ) : (
                          <Download size={18} className="text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => searchUnsplash(unsplashPage - 1)}
                  disabled={unsplashPage <= 1 || unsplashLoading}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-xs text-gray-500">Página {unsplashPage}</span>
                <button
                  onClick={() => searchUnsplash(unsplashPage + 1)}
                  disabled={unsplashLoading || unsplashResults.length < 20}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>

              <p className="text-xs text-gray-600 text-center">
                Fotos por{' '}
                <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="hover:text-gray-400 underline">
                  Unsplash
                </a>
              </p>
            </>
          )}

          {!unsplashResults.length && !unsplashLoading && !unsplashError && (
            <div className="flex flex-col gap-3 mt-2">
              <span className="text-xs font-semibold text-white">Tus descargas de Unsplash</span>
              {images.filter(img => img.id.startsWith('unsplash/')).length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {images.filter(img => img.id.startsWith('unsplash/')).map((img) => (
                    <button
                      key={img.id}
                      onClick={() => selectImage(img)}
                      className={`relative aspect-[9/16] overflow-hidden rounded-lg border-2 transition-all ${
                        config.imageId === img.id
                          ? 'border-brand-500'
                          : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                      {(img.usageCount ?? 0) > 0 && (
                        <span className="absolute top-1 right-1 text-xs bg-black/70 text-brand-400 rounded px-1 py-0.5 font-medium leading-none">
                          ×{img.usageCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-6">
                  Busca: "forest", "body", "nature", "minimal", "water"...
                  <br />
                  Vertical · licencia comercial libre.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Pinterest ──────────────────────────────────── */}
      {tab === 'pinterest' && (
        <div className="flex flex-col gap-5 p-3">

          {/* ── Pinterest via gallery-dl ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Añade tablero de Pinterest</span>
              <a
                href="https://github.com/mikf/gallery-dl"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-brand-400 hover:underline flex items-center gap-0.5"
              >
                gallery-dl <ExternalLink size={9} />
              </a>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={galleryDlUrl}
                onChange={(e) => setGalleryDlUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGalleryDl()}
                placeholder="https://pinterest.com/usuario/tablero/"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              <button
                onClick={handleGalleryDl}
                disabled={galleryDlLoading || !galleryDlUrl.trim()}
                className="flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-500 disabled:opacity-40 rounded-lg px-3 py-2 text-white transition-colors whitespace-nowrap"
              >
                {galleryDlLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {galleryDlLoading ? 'Descargando...' : 'Descargar'}
              </button>
            </div>

            {galleryDlLoading && (
              <p className="text-xs text-gray-500 text-center animate-pulse">
                Descargando tablero, puede tardar unos minutos...
              </p>
            )}

            {galleryDlError && (
              <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                {galleryDlError}
              </p>
            )}

            {galleryDlResult && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                <p className="text-xs text-green-400 font-medium">✓ {galleryDlResult.message}</p>
              </div>
            )}

            <p className="text-[11px] text-gray-600">
              Requiere <span className="font-mono">gallery-dl</span> instalado:{' '}
              <span className="font-mono">pip install gallery-dl</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
