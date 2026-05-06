import { useState } from 'react'
import { Download, HardDrive, ExternalLink, Upload } from 'lucide-react'
import { ComposedImageOutput, composerApi } from '../../api'

interface Props {
  images: ComposedImageOutput[]
  aspectRatio: string
  onToast: (msg: string, type: 'success' | 'error') => void
}

export default function ImageResult({ images, aspectRatio, onToast }: Props) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [driveUrls, setDriveUrls] = useState<Record<string, string>>({})
  const [s3Urls, setS3Urls] = useState<Record<string, string>>({})

  const uploadToS3 = async (img: ComposedImageOutput) => {
    setUploading(`s3-${img.type}`)
    try {
      const { s3Url } = await composerApi.uploadToS3(img.localPath, img.filename)
      setS3Urls((prev) => ({ ...prev, [img.type]: s3Url }))
      onToast('Subido a S3 correctamente', 'success')
    } catch (e: any) {
      onToast('Error al subir a S3: ' + e.message, 'error')
    } finally {
      setUploading(null)
    }
  }

  const uploadToDrive = async (img: ComposedImageOutput) => {
    setUploading(`drive-${img.type}`)
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
          style={{ aspectRatio, maxHeight: '200px', objectFit: 'cover' }}
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

        {s3Urls[img.type] ? (
          <a
            href={s3Urls[img.type]}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 bg-spirit-card hover:bg-spirit-border border border-spirit-border text-white rounded-lg px-2.5 py-2 transition-colors text-xs font-medium"
          >
            <ExternalLink size={12} />
          </a>
        ) : (
          <button
            onClick={() => uploadToS3(img)}
            disabled={uploading === `s3-${img.type}`}
            className="flex items-center justify-center gap-1 bg-spirit-card hover:bg-spirit-border border border-spirit-border text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-2.5 py-2 transition-colors text-xs font-medium"
            title="Subir a S3"
          >
            <Upload size={12} />
            {uploading === `s3-${img.type}` ? '...' : 'S3'}
          </button>
        )}

        {driveUrls[img.type] ? (
          <a
            href={driveUrls[img.type]}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 rounded-lg px-2.5 py-2 transition-colors text-xs font-medium"
          >
            <ExternalLink size={12} />
          </a>
        ) : (
          <button
            onClick={() => uploadToDrive(img)}
            disabled={uploading === `drive-${img.type}`}
            className="flex items-center justify-center gap-1 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-2.5 py-2 transition-colors text-xs font-medium"
            title="Subir a Drive"
          >
            <HardDrive size={12} />
            {uploading === `drive-${img.type}` ? '...' : ''}
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
