# Sistema de Frases y Pares Únicos — Spec de Diseño

**Fecha:** 2026-05-06
**Proyecto:** `AppCreatorViralVideos/OrganicIntelligences`
**Alcance:** Gestión editorial de frases, sugerencia inteligente de pares frase+imagen, generación con IA, y limpieza de assets.

---

## Contexto

OrganicIntelligences produce contenido bajo la filosofía **"Inteligencia Orgánica"**: validar la experiencia humana a través de la biología. Cada pieza tiene estructura gancho//remate. Las 3 categorías editoriales son fijas: *Sincronía Natural*, *Sabiduría del Cuerpo*, *Ritmo Vital*.

El problema actual: no hay control sobre repetición de contenido. Una misma frase puede usarse con la misma imagen múltiples veces, y no hay forma de saber qué combinaciones están agotadas.

**Unidad de repetición:** el par `frase + imagen`. Una frase puede usarse con imágenes distintas. Una imagen puede usarse con frases distintas. Lo que nunca debe repetirse es la combinación exacta.

---

## 1. Modelo de Datos

### Phrase — cambios

```ts
interface Phrase {
  id: string
  text: string
  category: 'Sincronía Natural' | 'Sabiduría del Cuerpo' | 'Ritmo Vital'
  author: 'Inteligencia Orgánica'
  usageCount: number        // normalizar a 0 si undefined
  status: 'active' | 'pending'  // nuevo campo
}
```

- `status: 'active'` — disponible para uso y sugerencias
- `status: 'pending'` — generada por IA, esperando aprobación editorial
- Las frases importadas via bulk van directo a `active`
- Las frases generadas por IA van a `pending` hasta que el usuario apruebe

### VideoRecord — sin cambios

El par usado se deriva en runtime de `videos.json`: cada registro ya tiene `phraseId` + `config.imageId`. No se necesita archivo adicional.

```ts
// Nuevo campo para marcar registros cuyo archivo físico fue eliminado
interface VideoRecord {
  // ... campos existentes ...
  filesDeleted?: boolean   // true cuando el .mp4 fue limpiado del disco
}
```

---

## 2. Algoritmo de Sugerencia Inteligente

**Endpoint:** `GET /api/phrases/suggest?imageId=<optional>`

```
1. Leer videos.json → construir Set<"phraseId:imageId"> de pares ya usados
2. Contar publicaciones por categoría en los últimos 30 días
3. Elegir la categoría con menos publicaciones recientes
4. Filtrar frases: status='active' + categoría elegida
5. Ordenar por usageCount ASC → tomar la frase menos usada
6. Si imageId viene en query:
   - Verificar que el par no esté en el set de usados
   - Si está usado → responder 409 con mensaje "Par ya utilizado"
7. Si no viene imageId:
   - Leer imágenes disponibles en data/images/
   - Filtrar las que NO aparecen combinadas con esta frase en el set
   - Elegir aleatoriamente entre las libres
8. Calcular pairsRemaining: (imágenes totales) - (imágenes ya usadas con esta frase)
9. Retornar: { phrase, imageId, imagePath, imageUrl, category, pairsRemaining }
```

Si no hay pares libres en ninguna categoría → responder con `{ exhausted: true }`.

---

## 3. UI — Botón "Generar combinación nueva"

**Ubicación:** Panel central de acciones en `Editor.tsx`, encima del botón principal de generar.

**Comportamiento:**
1. Llama a `GET /api/phrases/suggest`
2. Carga imagen sugerida: `setConfig({ imageId, imagePath, imagePreviewUrl })`
3. Carga frase: `setText({ content: phrase.text })`
4. Muestra chip: categoría + número de pares libres restantes
5. Si el usuario cambia imagen manualmente → validar par en tiempo real:
   - Borde verde: par libre
   - Borde rojo + tooltip: "Esta combinación ya fue usada"
6. Si `exhausted: true` → mensaje "Todas las combinaciones usadas" + botón directo a "Generar con IA"

---

## 4. Pestaña Frases — Panel de Administración

La pestaña se reorganiza en 3 bloques colapsables:

### Bloque A — Inventario
- Pills de filtro: `Todas | Sincronía Natural | Sabiduría del Cuerpo | Ritmo Vital`
- Toggle: `Activas | Pendientes`
- Lista: texto truncado, categoría, `usageCount`, pares libres disponibles (X/N imágenes)
- Botón "Usar esta" → carga la frase en el editor

### Bloque B — Importar Bulk
- Textarea: frases separadas por salto de línea
- Selector de categoría para el lote completo
- Botón "Importar" → `POST /api/phrases/bulk` con categoría y `status: 'active'`
- Confirmación: "X frases importadas"

### Bloque C — Generar con IA
- Selector de categoría objetivo
- Slider: cantidad de frases a generar (5–15)
- Botón "Generar" → `POST /api/phrases/generate-ai`
- El servidor llama a Claude con el prompt del estilo Inteligencia Orgánica
- Respuesta: lista de frases en estado `pending` con checkboxes
- Botón "Aprobar seleccionadas" → `PATCH /api/phrases/approve` con array de ids
- Las aprobadas pasan a `status: 'active'`, las desmarcadas se descartan

**Prompt del sistema para generación IA:**
```
Eres el editor de contenido de "Inteligencia Orgánica". Genera frases que:
- Validen una experiencia humana común a través de un mecanismo biológico real
- Tengan estructura gancho//remate (separados por //)
- Categoría: [CATEGORÍA SELECCIONADA]
- Tono: cálido, directo, empático, nunca moralizador
- Terminen con una afirmación que devuelva poder al lector
- Máximo 200 palabras por frase
- Nunca uses frases vagas sin mecanismo biológico concreto
```

---

## 5. Limpieza de Assets

### Automática (cada 7 días)
- Archivos `.mp4`, `.jpg`, `.png` en `output/` y `output-images/` con más de 30 días → borrar del disco
- En `videos.json`: marcar `filesDeleted: true`, limpiar `localPath` y `publicUrl`
- `phraseId`, `imageId`, `createdAt` se conservan → memoria de pares intacta

### Manual (botón en la app)
- Botón "Limpiar assets" en el panel de acciones
- Preview antes de ejecutar: "Se liberarán X MB — Y archivos de más de 30 días"
- Confirmación → ejecuta la misma lógica on-demand
- Endpoint: `POST /api/videos/cleanup`

---

## 6. Nuevos Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/phrases/suggest` | Sugerencia inteligente de par frase+imagen |
| `POST` | `/api/phrases/generate-ai` | Generar frases con Claude (devuelve pending) |
| `PATCH` | `/api/phrases/approve` | Aprobar lote de frases pending → active |
| `POST` | `/api/videos/cleanup` | Limpieza manual de assets viejos |

---

## 7. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `server/src/routes/phrases.ts` | Añadir `/suggest`, `/generate-ai`, `/approve` |
| `server/src/routes/videos.ts` | Añadir `/cleanup` |
| `server/src/services/cleanupService.ts` | Actualizar lógica para conservar huella JSON |
| `server/src/types/index.ts` | Actualizar `Phrase` con `status`, `VideoRecord` con `filesDeleted` |
| `client/src/components/PhraseBank/PhraseBank.tsx` | Rediseño completo como admin panel |
| `client/src/pages/Editor.tsx` | Botón "Generar combinación nueva" + validación de par |
| `client/src/api/index.ts` | Nuevos métodos: `suggest`, `generateAI`, `approve`, `cleanup` |
| `data/phrases.json` | Migrar frases existentes: añadir `status: 'active'`, `usageCount: 0` |
