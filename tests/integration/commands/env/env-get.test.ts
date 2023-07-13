import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'

import routes from './api-routes.js'

describe('env:get command', () => {
  setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    test.concurrent<FixtureTestContext>('should return empty object if var not set', async ({ fixture }) => {
      const cliResponse = await fixture.callCli(['env:get', '--json', 'SOME_VAR'], {
        offline: false,
        parseJson: true,
      })

      expect(cliResponse).toEqual({})
    })

    test.concurrent<FixtureTestContext>(
      'should return the value for the given context when present',
      async ({ fixture }) => {
        const cliResponse = await fixture.callCli(['env:get', '--json', 'EXISTING_VAR', '--context', 'production'], {
          offline: false,
          parseJson: true,
        })

        expect(cliResponse.EXISTING_VAR).toBe('envelope-prod-value')
      },
    )

    test.concurrent<FixtureTestContext>(
      'should not return the value for the given context when not present',
      async ({ fixture }) => {
        const cliResponse = await fixture.callCli(
          ['env:get', '--json', 'EXISTING_VAR', '--context', 'deploy-preview'],
          {
            offline: false,
            parseJson: true,
          },
        )

        expect(cliResponse.EXISTING_VAR).toBeUndefined()
      },
    )

    test.concurrent<FixtureTestContext>(
      'should find the value for the given scope when present',
      async ({ fixture }) => {
        const cliResponse = await fixture.callCli(['env:get', '--json', 'EXISTING_VAR', '--scope', 'functions'], {
          offline: false,
          parseJson: true,
        })

        expect(cliResponse.EXISTING_VAR).toBe('envelope-dev-value')
      },
    )

    test.concurrent<FixtureTestContext>(
      'should not find the value for the given scope when not present',
      async ({ fixture }) => {
        const cliResponse = await fixture.callCli(['env:get', '--json', 'EXISTING_VAR', '--scope', 'runtime'], {
          offline: false,
          parseJson: true,
        })

        expect(cliResponse.EXISTING_VAR).toBeUndefined()
      },
    )
  })
})
