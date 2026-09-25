import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { ClientRequest } from 'node:http'
import http from 'node:http'
import type net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import ProxyServer from 'http-proxy'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { tryGetAgent } from '../../../src/lib/http-agent.js'

describe('tryGetAgent', () => {
  test(`should return an empty object when there is no httpProxy`, async () => {
    expect(await tryGetAgent({})).toEqual({})
  })

  test(`should return error on invalid url`, async () => {
    const httpProxy = 'invalid_url'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error', expect.any(String))
  })

  test(`should return error when scheme is not http or https`, async () => {
    const httpProxy = 'file://localhost'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error', expect.any(String))
  })

  test(`should return error when proxy is not available`, async () => {
    const httpProxy = 'https://unknown:7979'
    const result = await tryGetAgent({ httpProxy })

    expect(result).toHaveProperty('error', expect.any(String))
  })

  test(`should return agent for a valid proxy`, async () => {
    const proxy = ProxyServer.createProxyServer()
    const server = http.createServer(function onRequest(req, res) {
      proxy.web(req, res, { target: 'http://localhost:5555' })
    })

    await new Promise<void>((resolve) => {
      server.listen({ port: 0, hostname: 'localhost' }, () => {
        resolve()
      })
    })

    const httpProxyUrl = `http://localhost:${(server.address() as net.AddressInfo).port.toString()}`
    const result = await tryGetAgent({ httpProxy: httpProxyUrl })

    if (!('agent' in result)) {
      throw new Error('expected result to include agent')
    }
    expect(result.agent).toBeInstanceOf(HttpsProxyAgent)

    server.close()
  })

  describe('with a running proxy', () => {
    const servers: http.Server[] = []

    const startProxy = async () => {
      const server = http.createServer((_req, res) => {
        res.end()
      })
      servers.push(server)
      await new Promise<void>((resolve) => {
        server.listen({ port: 0, hostname: 'localhost' }, () => {
          resolve()
        })
      })
      return (server.address() as net.AddressInfo).port
    }

    afterEach(() => {
      servers.splice(0).forEach((server) => server.close())
      vi.restoreAllMocks()
    })

    test('should keep the credentials of the proxy URL', async () => {
      const port = await startProxy()
      const result = await tryGetAgent({ httpProxy: `http://user:secret@localhost:${port.toString()}` })

      if (result.agent === undefined) {
        throw new Error('expected result to include agent')
      }
      expect(result.agent.proxy.username).toBe('user')
      expect(result.agent.proxy.password).toBe('secret')
    })

    test('should use the certificate file for TLS connections through the proxy', async () => {
      const port = await startProxy()
      const directory = await mkdtemp(join(tmpdir(), 'http-agent-'))
      const certificateFile = join(directory, 'proxy.pem')
      await writeFile(certificateFile, 'certificate contents')

      try {
        const result = await tryGetAgent({ httpProxy: `http://localhost:${port.toString()}`, certificateFile })

        if (result.agent === undefined) {
          throw new Error('expected result to include agent')
        }
        const connect = vi.spyOn(HttpsProxyAgent.prototype, 'connect').mockRejectedValue(new Error('not connecting'))
        const req = {} as ClientRequest

        await expect(
          result.agent.connect(req, { secureEndpoint: true, host: 'example.com', port: 443 }),
        ).rejects.toThrow('not connecting')

        expect(connect).toHaveBeenCalledWith(req, expect.objectContaining({ ca: Buffer.from('certificate contents') }))
      } finally {
        await rm(directory, { force: true, recursive: true })
      }
    })
  })
})
