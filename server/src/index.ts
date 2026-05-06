import express from 'express'
import cors from 'cors'
import path from 'path'
import { config } from './config'
import videosRouter from './routes/videos'
import imagesRouter from './routes/images'
import phrasesRouter from './routes/phrases'
import uploadRouter from './routes/upload'
import composeRouter from './routes/compose'

const app = express()

app.use(cors({ origin: /^http:\/\/localhost(:\d+)?$/ }))
app.use(express.json())

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// Servir videos generados como archivos estáticos (URL pública directa para n8n/Meta)
app.use('/output', express.static(path.resolve(config.paths.output)))
app.use('/output-images', express.static(path.resolve(config.paths.outputImages)))
app.use('/data', express.static(path.resolve(__dirname, '../../data')))

app.use('/api/videos', videosRouter)
app.use('/api/images', imagesRouter)
app.use('/api/phrases', phrasesRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/compose', composeRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

import { startCleanupService } from './services/cleanupService'

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`)
  console.log(`Output folder: ${config.paths.output}`)
  console.log(`Images folder: ${config.paths.images}`)
  console.log(`Fonts folder: ${config.paths.fonts}`)
  
  // Iniciar servicio de limpieza automática de videos antiguos
  startCleanupService()
})
