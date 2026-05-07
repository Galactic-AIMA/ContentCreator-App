import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../../.env') })

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3001',

  paths: {
    images: process.env.IMAGES_PATH || path.join(__dirname, '../../data/images'),
    output: process.env.OUTPUT_PATH || path.join(__dirname, '../../output'),
    outputImages: process.env.OUTPUT_IMAGES_PATH || path.join(__dirname, '../../output-images'),
    fonts: process.env.FONTS_PATH || path.join(__dirname, '../../data/fonts'),
    phrases: path.join(__dirname, '../../data/phrases.json'),
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.AWS_S3_BUCKET || '',
  },

  unsplash: {
    accessKey: process.env.UNSPLASH_ACCESS_KEY || '',
  },

  webhooks: {
    test: process.env.WEBHOOK_TEST_URL || '',
    prod: process.env.WEBHOOK_PROD_URL || '',
    s3Upload: process.env.WEBHOOK_S3_URL || 'https://n8n.galacticaima.com/webhook/organic-intelligence',
  },
}
