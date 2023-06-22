import { version } from 'process'

import { gte } from 'semver'
import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.cjs'

describe.runIf(gte(version, '18.13.0'))('v2 api', () => {
  setupFixtureTests('dev-server-with-v2-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should successfully be able to run v2 functions', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/.netlify/functions/ping`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('pong')
    })

    test<FixtureTestContext>('supports streamed responses', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/stream`)

      expect(response.status).toBe(200)

      const reader = response.body!.getReader()

      const firstChunk = await reader.read()
      expect(new TextDecoder().decode(firstChunk.value)).toBe('first chunk')
      expect(firstChunk.done).toBeFalsy()

      const secondChunk = await reader.read()
      expect(new TextDecoder().decode(secondChunk.value)).toBe('second chunk')
      expect(secondChunk.done).toBeFalsy()

      const thirdChunk = await reader.read()
      expect(thirdChunk.done).toBeTruthy()
    })

    test<FixtureTestContext>('receives context', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/context`, {
        headers: {
          Cookie: 'foo=bar;',
        },
      })

      expect(response.status).toBe(200)

      const context = await response.json()
      expect(context.requestId).toEqual(response.headers.get('x-nf-request-id'))
      expect(context.site.url).toEqual(`http://localhost:${devServer.port}`)
      expect(context.server.region).toEqual('dev')
      expect(context.ip).toEqual('::1')
      expect(context.geo.city).toEqual('San Francisco')

      expect(context).toEqual('')

      expect(context.cookies).toEqual({ foo: 'bar' })
      // this is also not set for edge-functions, TODO!
      expect(context.account.id).toEqual('???')
    })

    test<FixtureTestContext>('logging works', async ({ devServer }) => {
      const response = await fetch(`http://localhost:${devServer.port}/.netlify/functions/log`)
      expect(response.status).toBe(200)
      expect(devServer.outputBuffer.map((buffer) => buffer.toString())).toContain('🪵🪵🪵\n')
    })
  })
})
