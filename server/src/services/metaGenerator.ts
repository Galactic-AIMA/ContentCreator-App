import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export interface VideoMeta {
  title: string
  description: string
  tags: string[]
}

const FOOTER = 'Tu cuerpo sabe.\n@inteligencia.organica 🌿'

export async function generateMeta(phrase: string): Promise<VideoMeta> {
  const prompt = `Eres un copywriter experto en contenido de bienestar consciente para Instagram Reels y YouTube Shorts de la marca "Inteligencia Orgánica".

La filosofía de la marca: validar la experiencia humana a través de la biología. El cuerpo no está roto, está respondiendo. Tono cálido, directo y empático — nunca moralizador ni de autoayuda vacía.

Dado el siguiente texto que aparecerá en un video:
"${phrase}"

Genera un JSON (sin markdown, solo el objeto JSON puro) con estas claves:

- "title": título corto y llamativo (máx 60 caracteres, en español, sin emojis, sin signos de puntuación como dos puntos o comillas que puedan romper nombres de archivo)

- "description": descripción estructurada con el siguiente formato exacto:

TITULAR: Una frase corta (máximo 6 palabras) que genere reconocimiento o curiosidad. Que el lector sienta "eso me pasa a mí".

[línea en blanco]

CUERPO:

[párrafo 1: describe la experiencia humana común que valida la frase, con el mecanismo biológico detrás]

[párrafo 2: explica por qué el cuerpo responde así — sin juicio, con ciencia accesible]

[párrafo 3: afirmación que devuelve poder al lector. No "haz esto", sino "tú ya tienes esto"]

[línea en blanco]

Tu cuerpo sabe.
@inteligencia.organica 🌿

Reglas de redacción:
- Lenguaje inclusivo y cálido, sin ser condescendiente
- No uses palabras de autoayuda vacía como "increíble", "mágico", "manifiesta"
- Usa vocabulario concreto: cortisol, sistema nervioso, ritmo circadiano, neurotransmisores
- Prohibido el optimismo tóxico. Se valida el dolor y la incomodidad como señales del cuerpo

- "tags": array de exactamente 10 hashtags relevantes que mezclen el tema biológico con bienestar, autocuidado y la marca. Sin el símbolo #, solo el texto.

Responde ÚNICAMENTE con el JSON, sin explicaciones ni markdown.`

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
    if (!parsed.description.includes('@inteligencia.organica')) {
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
