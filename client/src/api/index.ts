import axios from 'axios'
import { Phrase, ImageItem, VideoRecord, VideoConfig, VideoMeta, SegmentLayout } from '../types'

const api = axios.create({ baseURL: '/api' })

export const imagesApi = {
  list: () => api.get<ImageItem[]>('/images').then((r) => r.data),
  random: () => api.get<ImageItem>('/images/random').then((r) => r.data),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('image', file)
    return api.post<ImageItem>('/upload/image', fd).then((r) => r.data)
  },
}

export const phrasesApi = {
  list: () => api.get<Phrase[]>('/phrases').then((r) => r.data),
  random: () => api.get<Phrase>('/phrases/random').then((r) => r.data),
  create: (data: Omit<Phrase, 'id'>) =>
    api.post<Phrase>('/phrases', data).then((r) => r.data),
  bulkCreate: (texts: string[]) =>
    api.post<Phrase[]>('/phrases/bulk', { texts }).then((r) => r.data),
  update: (id: string, data: Partial<Phrase>) =>
    api.put<Phrase>(`/phrases/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/phrases/${id}`),
  generateMeta: (text: string, signal?: AbortSignal) =>
    api
      .post<{ title: string; description: string; tags: string[] }>('/phrases/generate-meta', { text }, { signal })
      .then((r) => r.data),
}

export const videosApi = {
  list: () => api.get<VideoRecord[]>('/videos').then((r) => r.data),
  generate: (config: VideoConfig, meta: VideoMeta, phraseId?: string) =>
    api
      .post<{ jobId: string; status: string }>('/videos/generate', { config, ...meta, phraseId })
      .then((r) => r.data),
  getStatus: (jobId: string) =>
    api.get<{ id: string; status: string; progress: number; result?: VideoRecord; error?: string }>(`/videos/status/${jobId}`)
      .then((r) => r.data),
  uploadToS3: (id: string) =>
    api.post<{ s3Url: string }>(`/videos/${id}/upload-s3`).then((r) => r.data),
  uploadToDrive: (id: string) =>
    api.post<{ driveUrl: string }>(`/videos/${id}/upload-drive`).then((r) => r.data),
  publish: (id: string, env: 'test' | 'prod') =>
    api.post(`/videos/${id}/publish`, { env }).then((r) => r.data),
  remove: (id: string) => api.delete(`/videos/${id}`),
}

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

  uploadToS3: (localPath: string, filename: string) =>
    api
      .post<{ s3Url: string }>('/compose/image-s3', { localPath, filename })
      .then((r) => r.data),
  uploadToDrive: (localPath: string, filename: string) =>
    api
      .post<{ driveUrl: string }>('/compose/image-drive', { localPath, filename })
      .then((r) => r.data),
}
