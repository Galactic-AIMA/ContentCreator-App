import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export interface VideoMeta {
  title: string
  description: string
  tags: string[]
}

const FOOTER = 'El proceso no se negocia.\n@bebetter.path ⚔️'

export async function generateMeta(phrase: string): Promise<VideoMeta> {
  const prompt = `Eres un copywriter experto en contenido motivacional para Instagram Reels y YouTube Shorts de la marca "bebetter".

Dado el siguiente texto que aparecera en un video:
"${phrase}"

Genera un JSON (sin markdown, solo el objeto JSON puro) con estas claves:

- "title": titulo corto y llamativo (max 60 caracteres, en español, sin emojis, sin signos de puntuacion como dos puntos o comillas que puedan romper nombres de archivo)

- "description": descripcion estructurada con el siguiente formato exacto:

TITULAR: Una frase corta (maximo 6 palabras) que sea una bofetada visual. Debe generar curiosidad o incomodidad.

[linea en blanco]

CUERPO:

[parrafo 1: describe el problema o la debilidad comun de la sociedad]

[parrafo 2: da la solucion estoica o la verdad cruda]

[parrafo 3: llamado a la accion mental, no de "dar like" sino de "empezar a actuar"]

[linea en blanco]

El proceso no se negocia.
@bebetter.path ⚔️

Reglas de redaccion:
- Lenguaje masculino, fuerte y directo
- No uses emojis felices. Solo ⚔️ o 🔥 si es muy necesario
- Evita palabras como "increible", "asombroso" o "magico". Usa "brutal", "crudo", "inevitable", "deuda", "disciplina"
- Prohibido el optimismo toxico. Se respeta el dolor del proceso

- "tags": array de exactamente 10 hashtags relevantes que mezclen el tema de la frase con la marca y el nicho (estoicismo, disciplina, etc.). Sin el simbolo #, solo el texto.

Responde UNICAMENTE con el JSON, sin explicaciones ni markdown.`

  let result
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      result = await model.generateContent(prompt)
      break
    } catch (err: any) {
      if (attempt < 2 && err.message?.includes('429')) {
        await new Promise((r) => setTimeout(r, 5000))
      } else {
        throw err
      }
    }
  }
  const text = result!.response.text().trim().replace(/^```json\s*|```$/g, '')

  try {
    const parsed = JSON.parse(text) as VideoMeta
    if (!parsed.description.includes('@bebetter.path')) {
      parsed.description = parsed.description.trimEnd() + '\n\n' + FOOTER
    }
    return parsed
  } catch {
    return {
      title: phrase.slice(0, 80),
      description: FOOTER,
      tags: [],
    }
  }
}
