import { pause } from './pause.js'

export const fetchWithRetry = async (url: string, options?: RequestInit, maxRetries = 5): Promise<Response> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.status !== 404) {
        return response
      }
      if (i < maxRetries - 1) {
        await pause(2000 * (i + 1))
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await pause(2000 * (i + 1))
    }
  }
  return fetch(url, options)
}
