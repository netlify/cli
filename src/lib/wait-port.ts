import net from 'net'

export const waitPort = async (
  port: number,
  host: string,
  timeout: number,
  maxRetries = 10,
): Promise<{ open: boolean; ipVersion?: 4 | 6 }> => {
  const startTime = Date.now()

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (Date.now() - startTime > timeout) {
      return { open: false }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket()
        let isResolved = false

        const cleanup = () => {
          if (!isResolved) {
            socket.destroy()
          }
        }

        socket.on('connect', () => {
          isResolved = true
          socket.end()
          resolve()
        })

        socket.on('error', (error) => {
          isResolved = true
          cleanup()
          reject(error)
        })

        socket.setTimeout(1000, () => {
          isResolved = true
          cleanup()
          reject(new Error('Socket timeout'))
        })

        socket.connect(port, host)
      })

      return { open: true, ipVersion: net.isIPv6(host) ? 6 : 4 }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, Math.min(100 * (attempt + 1), 1000)))
      continue
    }
  }

  return { open: false }
}
