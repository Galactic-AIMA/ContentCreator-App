import { z } from 'zod';

export const textConfigSchema = z.object({
  content: z.string(),
  font: z.string(),
  fontSize: z.number().positive(),
  color: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  align: z.enum(['left', 'center', 'right']),
  shadow: z.boolean(),
  maxWidth: z.number().positive(),
  lineHeight: z.number().positive(),
  fontWeight: z.number(),
  fontStyle: z.enum(['normal', 'italic']),
  highlightColor: z.string(),
  strokeColor: z.string(),
  strokeWidth: z.number().min(0),
});

export const segmentLayoutSchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  color: z.string(),
});

export const videoConfigSchema = z.object({
  imageId: z.string().min(1),
  imagePath: z.string().min(1),
  duration: z.number().positive(),
  transition: z.enum(['fade', 'fadeBlack', 'none']),
  transitionDuration: z.number().min(0),
  text: textConfigSchema,
  resolution: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  outputName: z.string().optional(),
  wrappedLines: z.array(z.string()).optional(),
  segmentLayouts: z.array(segmentLayoutSchema).optional(),
  style: z.enum(['serene', 'raw', 'minimal', 'cinematic', 'bold']),
  textEffect: z.enum(['fadeIn', 'typewriter', 'slideUp', 'scaleIn', 'glowPulse', 'none']),
  watermark: z.boolean().optional(),
  watermarkPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  cinematicGrain: z.boolean().optional(),
});

export const generateVideoRequestSchema = z.object({
  config: videoConfigSchema,
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  phraseId: z.string().optional().nullable(),
});
