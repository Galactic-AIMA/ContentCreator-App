/**
 * Utility to run a task with exponential backoff retries.
 * Specially useful for external APIs with rate limits like Gemini.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelayMs?: number
    backoffFactor?: number
    retryIf?: (err: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 2000,
    backoffFactor = 2.5,
    retryIf = (err) => err.message?.includes('429') || err.message?.includes('500') || err.message?.includes('503'),
  } = options

  let lastError: any
  let delay = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await task()
    } catch (err: any) {
      lastError = err
      
      const shouldRetry = attempt < maxAttempts && retryIf(err)
      if (!shouldRetry) throw err

      console.warn(`[Retry] Attempt ${attempt} failed with error: ${err.message}. Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= backoffFactor
    }
  }

  throw lastError
}
