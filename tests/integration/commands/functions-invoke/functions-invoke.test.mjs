import got from 'got'
import { describe, expect, test } from 'vitest'

import { setupFixtureTests } from '../../utils/fixture.mjs'

describe('functions:invoke command', () => {
  setupFixtureTests({ devServer: true, fixture: 'dev-server-with-functions' }, () => {
    test.concurrent(
      'should return function response when invoked with no identity argument',
      async ({ devServer, fixture }) => {
        const stdout = await fixture.callCli(['functions:invoke', 'ping', `--port=${devServer.port}`])

        expect(stdout).toBe('ping')
      },
    )

    test.concurrent('should return function response when invoked', async ({ devServer, fixture }) => {
      const stdout = await fixture.callCli(['functions:invoke', 'ping', '--identity', `--port=${devServer.port}`])

      expect(stdout).toBe('ping')
    })

    test.concurrent('should trigger background function from event', async ({ devServer, fixture }) => {
      const stdout = await fixture.callCli([
        'functions:invoke',
        'identity-validate-background',
        '--identity',
        `--port=${devServer.port}`,
      ])

      // background functions always return an empty response
      expect(stdout).toBe('')
    })

    test.concurrent('should serve helpful tips and tricks', async ({ devServer, fixture }) => {
      const plainTextResponse = await got(`http://localhost:${devServer.port}/.netlify/functions/scheduled-isc`, {
        throwHttpErrors: false,
        retry: null,
      })

      const youReturnedBodyRegex = /.*Your function returned `body`. Is this an accident\?.*/
      expect(plainTextResponse.body).toMatch(youReturnedBodyRegex)
      expect(plainTextResponse.body).toMatch(/.*You performed an HTTP request.*/)
      expect(plainTextResponse.statusCode).toBe(200)

      const htmlResponse = await got(`http://localhost:${devServer.port}/.netlify/functions/scheduled-isc`, {
        throwHttpErrors: false,
        retry: null,
        headers: {
          accept: 'text/html',
        },
      })

      expect(htmlResponse.body).toMatch(/.*<link.*/)
      expect(htmlResponse.statusCode).toBe(200)

      const stdout = await fixture.callCli([
        'functions:invoke',
        'scheduled-isc',
        '--identity',
        `--port=${devServer.port}`,
      ])
      expect(stdout).toMatch(youReturnedBodyRegex)
    })

    test.concurrent('should detect netlify-toml defined scheduled functions', async ({ devServer, fixture }) => {
      const stdout = await fixture.callCli(['functions:invoke', 'scheduled', `--port=${devServer.port}`])

      expect(stdout).toBe('')
    })
  })
})
