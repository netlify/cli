import { describe, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'

describe('functions:invoke command', async () => {
  await setupFixtureTests('dev-server-with-functions', { devServer: true }, () => {
    test.concurrent<FixtureTestContext>(
      'should return function response when invoked with no identity argument',
      async ({ devServer, expect, fixture }) => {
        const stdout = await fixture.callCli(['functions:invoke', 'ping', `--port=${devServer!.port.toString()}`])

        expect(stdout).toBe('ping')
      },
    )

    test.concurrent<FixtureTestContext>(
      'should return function response when invoked',
      async ({ devServer, expect, fixture }) => {
        const stdout = await fixture.callCli([
          'functions:invoke',
          'ping',
          '--identity',
          `--port=${devServer!.port.toString()}`,
        ])

        expect(stdout).toBe('ping')
      },
    )

    test.concurrent<FixtureTestContext>(
      'should trigger background function from event',
      async ({ devServer, expect, fixture }) => {
        const stdout = await fixture.callCli([
          'functions:invoke',
          'identity-validate-background',
          '--identity',
          `--port=${devServer!.port.toString()}`,
        ])

        // background functions always return an empty response
        expect(stdout).toBe('')
      },
    )

    test.concurrent<FixtureTestContext>(
      'should serve helpful tips and tricks',
      async ({ devServer, expect, fixture }) => {
        const textResponse = await fetch(
          `http://localhost:${devServer!.port.toString()}/.netlify/functions/scheduled-isc-body`,
          {},
        )

        const bodyPlainTextResponse = await textResponse.text()

        const youReturnedBodyRegex = /.*Your function returned `body`. Is this an accident\?.*/
        expect(bodyPlainTextResponse).toMatch(youReturnedBodyRegex)
        expect(bodyPlainTextResponse).toMatch(/.*You performed an HTTP request.*/)
        expect(textResponse.status).toBe(200)

        const htmlResponse = await fetch(
          `http://localhost:${devServer!.port.toString()}/.netlify/functions/scheduled-isc-body`,
          {
            headers: {
              accept: 'text/html',
            },
          },
        )

        const BodyHtmlResponse = await htmlResponse.text()

        expect(BodyHtmlResponse).toMatch(/.*<link.*/)
        expect(htmlResponse.status).toBe(200)

        const stdout = await fixture.callCli([
          'functions:invoke',
          'scheduled-isc-body',
          '--identity',
          `--port=${devServer!.port.toString()}`,
        ])
        expect(stdout).toMatch(youReturnedBodyRegex)
      },
    )

    test.concurrent<FixtureTestContext>(
      'should detect netlify-toml defined scheduled functions',
      async ({ devServer, expect, fixture }) => {
        const stdout = await fixture.callCli(['functions:invoke', 'scheduled', `--port=${devServer!.port.toString()}`])

        expect(stdout).toBe('')
      },
    )
  })
})
