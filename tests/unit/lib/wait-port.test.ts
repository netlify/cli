import net from 'node:net'

import { afterEach, describe, expect, test } from 'vitest'

import { waitPort } from '../../../src/lib/wait-port.js'

const getFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo
      server.close(() => {
        resolve(port)
      })
    })
  })

describe('waitPort', () => {
  const servers: net.Server[] = []

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))))
  })

  test('resolves as open when the port starts listening later but within the timeout', async () => {
    const port = await getFreePort()
    setTimeout(() => {
      const server = net.createServer()
      servers.push(server)
      server.listen(port)
    }, 1500)

    const result = await waitPort(port, 'localhost', 5000)

    expect(result.open).toBe(true)
  })

  test('resolves as open without crashing when the server resets the connection', async () => {
    const port = await getFreePort()
    const server = net.createServer((socket) => {
      socket.resetAndDestroy()
    })
    servers.push(server)
    await new Promise<void>((resolve) => server.listen(port, resolve))

    const result = await waitPort(port, 'localhost', 5000)
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(result.open).toBe(true)
  })

  test('keeps waiting until the timeout elapses when the port never opens', async () => {
    const port = await getFreePort()
    const timeout = 1500
    const startTime = Date.now()

    const result = await waitPort(port, 'localhost', timeout)

    expect(result).toEqual({ open: false })
    expect(Date.now() - startTime).toBeGreaterThanOrEqual(timeout)
  })
})
