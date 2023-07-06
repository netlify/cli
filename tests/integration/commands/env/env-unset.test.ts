import { describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'

import routes from './api-routes.js'

describe('env:unset command', () => {
  setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    test<FixtureTestContext>('should remove existing variable', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(['env:unset', '--json', 'EXISTING_VAR'], {
        offline: false,
        parseJson: true,
      })

      expect(cliResponse).toEqual({
        OTHER_VAR: 'envelope-all-value',
      })

      const deleteRequest = mockApi?.requests.find((request) => request.method === 'DELETE')

      expect(deleteRequest.path).toBe('/api/v1/accounts/test-account/env/EXISTING_VAR')
    })

    test<FixtureTestContext>('should remove existing variable value', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(['env:unset', 'EXISTING_VAR', '--context', 'production', '--json'], {
        offline: false,
        parseJson: true,
      })

      expect(cliResponse).toEqual({
        OTHER_VAR: 'envelope-all-value',
      })

      const deleteRequest = mockApi?.requests.find((request) => request.method === 'DELETE')

      expect(deleteRequest.path).toBe('/api/v1/accounts/test-account/env/EXISTING_VAR/value/1234')
    })

    test<FixtureTestContext>('should split up an `all` value', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(['env:unset', 'OTHER_VAR', '--context', 'branch-deploy', '--json'], {
        offline: false,
        parseJson: true,
      })

      expect(cliResponse).toEqual({})

      const deleteRequest = mockApi?.requests.find((request) => request.method === 'DELETE')

      expect(deleteRequest.path).toBe('/api/v1/accounts/test-account/env/OTHER_VAR/value/3456')

      const patchRequests = mockApi?.requests.filter(
        (request) => request.method === 'PATCH' && '/api/v1/accounts/test-account/env/OTHER_VAR',
      )

      expect(patchRequests).toHaveLength(3)
    })
  })
})
