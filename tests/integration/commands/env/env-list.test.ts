import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'

import routes from './api-routes.js'

describe('env:list command', () => {
  setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    test.concurrent<FixtureTestContext>('should return the object of keys and values', async ({ fixture }) => {
      const cliResponse = await fixture.callCli(['env:list', '--json'], {
        offline: false,
        parseJson: true,
      })

      expect(cliResponse).toEqual({
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      })
    })

    test.concurrent<FixtureTestContext>(
      'should return the keys and values for the given context',
      async ({ fixture }) => {
        const cliResponse = await fixture.callCli(['env:list', '--context', 'production', '--json'], {
          offline: false,
          parseJson: true,
        })

        expect(cliResponse).toEqual({
          EXISTING_VAR: 'envelope-prod-value',
          OTHER_VAR: 'envelope-all-value',
        })
      },
    )

    test.concurrent<FixtureTestContext>(
      'should return the keys and values for the given scope',
      async ({ fixture }) => {
        const cliResponse = await fixture.callCli(['env:list', '--scope', 'runtime', '--json'], {
          offline: false,
          parseJson: true,
        })

        expect(cliResponse).toEqual({
          OTHER_VAR: 'envelope-all-value',
        })
      },
    )
  })
})
