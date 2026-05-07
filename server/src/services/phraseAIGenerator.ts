import { GoogleGenerativeAI } from '@google/generative-ai'
import { v4 as uuidv4 } from 'uuid'
import { Phrase } from '../types'
import { config } from '../config'
import { withRetry } from '../utils/retry'

const genAI = new GoogleGenerativeAI(config.gemini.apiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

type Category = 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital'

export async function generateAIPhrases(category: Category, count: number): Promise<Phrase[]> {
  const prompt = `Eres el editor de contenido de "Inteligencia Orgánica". Genera exactamente ${count} frases para la categoría "${category}" que:
- Validen una experiencia humana común a través de un mecanismo biológico real
- Tengan estructura gancho//remate (separados por //)
- Tono: cálido, directo, empático, nunca moralizador
- Terminen con una afirmación que devuelva poder al lector
- Máximo 200 palabras por frase
- Nunca uses frases vagas sin mecanismo biológico concreto

Responde ÚNICAMENTE con un array JSON (sin markdown, sin explicaciones):
["gancho 1 // remate 1", "gancho 2 // remate 2", ...]`

  const result = await withRetry(() => model.generateContent(prompt), {
    maxAttempts: 3,
    initialDelayMs: 2000,
  })

  const raw = result.response.text().trim().replace(/^```(?:json)?\s*|\s*```$/g, '').trim()

  let texts: string[]
  try {
    texts = JSON.parse(raw) as string[]
  } catch {
    texts = raw.split('\n').filter((l) => l.includes('//'))
  }

  return texts
    .slice(0, count)
    .map((text) => ({
      id: uuidv4(),
      text: text.trim().replace(/^["']|["']$/g, ''),
      category,
      author: 'Inteligencia Orgánica',
      usageCount: 0,
      status: 'pending' as const,
    }))
    .filter((p) => p.text.length > 0)
}