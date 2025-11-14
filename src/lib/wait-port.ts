import net from 'net'

export const waitPort = async (
  port: number,
  host: string,
  timeout: number,
  maxRetries?: number,
): Promise<{ open: boolean; ipVersion?: 4 | 6 }> => {
  const startTime = Date.now()
  const retries = maxRetries ?? Math.ceil(timeout / 2000)

  for (let attempt = 0; attempt < retries; attempt++) {
    if (Date.now() - startTime > timeout) {
      return { open: false }
    }

    try {
      const ipVersion = await new Promise<4 | 6>((resolve, reject) => {
        const socket = new net.Socket()
        let isResolved = false

        socket.on('connect', () => {
          isResolved = true
          // Detect actual IP version from the connection
          const detectedVersion = socket.remoteFamily === 'IPv6' ? 6 : 4
          socket.end()
          resolve(detectedVersion)
        })

        socket.on('error', (error) => {
          if (!isResolved) {
            isResolved = true
            socket.destroy()
            reject(error)
          }
        })

        socket.setTimeout(1000, () => {
          if (!isResolved) {
            isResolved = true
            socket.destroy()
            reject(new Error('Socket timeout'))
          }
        })

        socket.connect(port, host)
      })

      return { open: true, ipVersion }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, Math.min(100 * (attempt + 1), 1000)))
      continue
    }
  }

  return { open: false }
}
