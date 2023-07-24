import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import got from '../../utils/got.cjs'
import { pause } from '../../utils/pause.cjs'

describe('edge functions', () => {
  setupFixtureTests('dev-server-with-edge-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should run edge functions in correct order', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/ordertest`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toMatchSnapshot()
    })

    test<FixtureTestContext>('should provide geo location', async ({ devServer }) => {
      const response = await got(`http://localhost:${devServer.port}/context`, {
        throwHttpErrors: false,
        retry: { limit: 0 },
      })

      const { geo } = JSON.parse(response.body)
      expect(geo.city).toEqual('Mock City')
      expect(geo.country.code).toEqual('DE')
    })
  })

  setupFixtureTests('dev-server-with-edge-functions', { devServer: true }, () => {
    test<FixtureTestContext>('should not remove other edge functions on change', async ({ devServer, fixture }) => {
      // we need to wait till file watchers are loaded
      await pause(500)

      await fixture.builder
        .withEdgeFunction({
          name: 'new',
          handler: async (_, context) => new Response('hello'),
          config: { path: ['/new'] },
        })
        .build()

      await devServer.waitForLogMatching('Loaded edge function new')

      expect(devServer.output).not.toContain('Removed edge function')
    })
  })
})
