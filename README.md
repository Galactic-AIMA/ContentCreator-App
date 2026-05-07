# OrganicIntelligences — Compositor de Contenido Visual

App de escritorio (React + Vite + Express + FFmpeg) para generar videos e imágenes con frases superpuestas, orientada a contenido motivacional para la cuenta **@inteligencia.organica**.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript (`tsx watch`) |
| Renderizado | FFmpeg vía `fluent-ffmpeg` |
| IA generativa | Google Gemini 2.0 Flash |
| Almacenamiento | AWS S3, Google Drive |
| Automatización | Webhook → n8n |
| Fuentes | Google Fonts (locales) + fallbacks Windows |

---

## Estructura del proyecto

```
OrganicIntelligences/
├── client/                  # React + Vite (puerto 5173)
│   └── src/
│       ├── pages/Editor.tsx      # Página principal — editor + lotes
│       ├── components/
│       │   ├── PhraseBank/       # Gestión de frases (inventario, importar, IA)
│       │   └── ImageBank/        # Gestión de imágenes
│       └── api/index.ts          # Cliente HTTP para el servidor
├── server/                  # Express (puerto 3001)
│   └── src/
│       ├── routes/
│       │   ├── phrases.ts        # CRUD frases + /suggest + /suggest-batch
│       │   ├── videos.ts         # Generar, listar, subir S3/Drive, open-output
│       │   ├── images.ts         # Generar imágenes estáticas
│       │   ├── upload.ts         # Subida de imágenes al banco
│       │   └── compose.ts        # Endpoint de composición avanzada
│       ├── services/
│       │   ├── videoGenerator.ts     # FFmpeg: video con texto animado
│       │   ├── imageGenerator.ts     # FFmpeg: imagen estática con texto
│       │   ├── phraseAIGenerator.ts  # Generación de frases con Gemini
│       │   ├── metaGenerator.ts      # Título/descripción/tags con Gemini
│       │   ├── queueService.ts       # Cola de renderizado (p-queue)
│       │   ├── s3Service.ts          # Upload a AWS S3
│       │   ├── driveService.ts       # Upload a Google Drive
│       │   ├── webhookService.ts     # POST a n8n al completar
│       │   └── cleanupService.ts     # Limpieza de archivos > 30 días
│       ├── types/index.ts            # Tipos compartidos
│       └── config.ts                 # Variables de entorno y rutas
├── data/
│   ├── phrases.json          # Base de datos de frases
│   ├── videos.json           # Registro de videos generados
│   ├── images.json           # Banco de imágenes
│   └── logo.png              # Marca de agua
└── output/                   # Videos generados
└── output-images/            # Imágenes generadas
```

---

## Instalación

```bash
# 1. Instalar dependencias (raíz + workspaces)
npm run install:all

# 2. Configurar variables de entorno
cp server/.env.example server/.env
# Editar server/.env con tus credenciales

# 3. Iniciar en desarrollo (cliente + servidor en paralelo)
npm run dev
```

Acceder en `http://localhost:5173`

---

## Variables de entorno (`server/.env`)

```env
PORT=3001
PUBLIC_BASE_URL=http://localhost:3001

# Google Gemini (generación de frases y metadatos)
GEMINI_API_KEY=

# AWS S3 (subida de archivos)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=

# Google Drive (subida alternativa)
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
GOOGLE_DRIVE_FOLDER_ID=

# n8n webhook (notificación al publicar)
N8N_WEBHOOK_URL=https://n8n.galacticaima.com/webhook/organic-intelligence

# Rutas locales
FONTS_DIR=./data/fonts
OUTPUT_DIR=./output
OUTPUT_IMAGES_DIR=./output-images
```

---

## Flujo de trabajo principal

### 1. Editor individual
1. Seleccionar imagen del **ImageBank**
2. Escribir frase o usar **Sugerir** (elige la frase con menor uso del banco)
3. Elegir preset visual (Serene, Raw, Minimal, Cinematic, Bold)
4. Ajustar parámetros (fuente, tamaño, posición, efectos)
5. **Preview** en tiempo real con canvas HTML5
6. **Generar** → FFmpeg renderiza el video/imagen
7. **Subir a S3** o **Google Drive** → dispara webhook a n8n

### 2. Generación en lotes
1. Elegir preset base y cantidad (3, 5 o 10 items)
2. El servidor calcula pares únicos `frase:imagen` sin repetición
3. Algoritmo de selección:
   - Balancea categorías (menos usadas primero)
   - Prioriza frases con menor `usageCount`
   - Garantiza que ningún par `phraseId:imageId` ya existe en `videos.json`
   - Evita repetir frases dentro del mismo lote
4. Renderizado secuencial con barra de progreso por item
5. Resultado: lista con links directos a cada video/imagen generado

---

## Sistema de frases

### Banco de frases (`PhraseBank`)
- **Inventario**: lista paginada con filtros por categoría y estado
- **Importar**: pegado masivo de texto plano (una frase por línea)
- **Generar con IA**: llama a Gemini con prompt de marca "Inteligencia Orgánica" para generar frases inéditas; quedan en estado `pending` hasta aprobación manual

### Categorías soportadas
- `Sincronía Natural`
- `Sabiduría del Cuerpo`
- `Ritmo Vital`
- (extensible — el campo `category` es `string`)

### Sugerencia inteligente (`GET /phrases/suggest`)
Devuelve la frase con menor `usageCount` de la categoría menos usada en los últimos 30 días, combinada con la imagen menos usada que no forme un par ya publicado.

### Sugerencia en lote (`GET /phrases/suggest-batch?count=N`)
Variante que devuelve N pares únicos. Algoritmo de dos pasadas:
1. **Pasada 1**: solo frases no usadas en el lote actual
2. **Pasada 2** (fallback): permite reutilizar frases si no hay suficientes

---

## Estilos visuales (presets)

| Preset | Resolución | Fuente | Efecto |
|---|---|---|---|
| **Serene** | 1080×1920 | Lora | fadeIn |
| **Raw** | 1080×1920 | Space Grotesk | typewriter |
| **Minimal** | 1080×1920 | Outfit | slideUp |
| **Cinematic** | 1080×1920 | Cinzel | glowPulse |
| **Bold** | 1080×1920 | Bebas Neue | scaleIn |

Todos los estilos soportan:
- Marca de agua (posición configurable: 4 esquinas)
- Grano cinematográfico (`cinematicGrain`)
- Sombra, stroke y color de resaltado en texto
- Transiciones entre clips: `fade`, `fadeBlack`, `none`

---

## API REST (puerto 3001)

### Frases
```
GET    /phrases                    Lista todas las frases
POST   /phrases                    Crear frase
PUT    /phrases/:id                Actualizar frase
DELETE /phrases/:id                Eliminar frase
GET    /phrases/suggest            Sugerir un par frase+imagen
GET    /phrases/suggest-batch      Sugerir N pares (?count=N)
POST   /phrases/bulk               Importar frases en masa
POST   /phrases/generate-ai        Generar frases con Gemini
POST   /phrases/approve            Aprobar/descartar frases pending
GET    /phrases/check-pair         Verificar si un par ya existe
```

### Videos
```
GET    /videos                     Lista videos generados
POST   /videos/generate            Generar video (encola en queue)
GET    /videos/:id/status          Estado del job de renderizado
POST   /videos/:id/upload-s3       Subir a S3
POST   /videos/:id/upload-drive    Subir a Google Drive
DELETE /videos/:id                 Eliminar video
POST   /videos/open-output         Abrir carpeta output en Explorer
```

### Imágenes
```
GET    /images                     Lista imágenes del banco
POST   /images/generate            Generar imagen estática
POST   /upload                     Subir imagen al banco
DELETE /images/:id                 Eliminar imagen del banco
```

---

## Metadatos automáticos (Gemini)

Al generar un video/imagen, `metaGenerator.ts` llama a Gemini para producir:
- **Título**: hasta 60 caracteres, estilo @inteligencia.organica
- **Descripción**: 2-3 líneas con llamada a la acción
- **Tags**: 8-10 hashtags relevantes en español

La marca identitaria es **"Inteligencia Orgánica"** — enfoque en bienestar, naturaleza, cuerpo y ritmo vital.

---

## Integración n8n

Cuando un video se sube a S3, el servidor hace `POST` al webhook configurado en `N8N_WEBHOOK_URL` con el payload:

```json
{
  "videoUrl": "https://s3.amazonaws.com/...",
  "title": "...",
  "description": "...",
  "tags": ["#tag1", "#tag2"],
  "filename": "video_abc123.mp4",
  "createdAt": "2026-05-06T...",
  "metadata": { ... }
}
```

El workflow de n8n recibe esto y puede publicar automáticamente a Instagram/TikTok/YouTube.

---

## Comandos útiles

```bash
npm run dev          # Inicia cliente (5173) + servidor (3001) en paralelo
npm run build        # Build de producción
npm run dev --workspace=server   # Solo servidor
npm run dev --workspace=client   # Solo cliente
```

---

## Notas de desarrollo

- **Fuentes locales**: colocar archivos `.ttf` en `data/fonts/`. Si no existe la fuente, se usa el fallback de Windows (`arial.ttf`, `impact.ttf`, etc.)
- **Cola de renderizado**: máximo 2 jobs concurrentes (configurable en `queueService.ts`)
- **Limpieza automática**: archivos de output con más de 30 días se eliminan automáticamente; el registro JSON conserva la huella histórica (`filesDeleted: true`)
- **tsx watch**: el servidor se recarga automáticamente al editar archivos `.ts`. Si muere silenciosamente, relanzar con `npm run dev --workspace=server`
