import { describe, expect, test, vi } from 'vitest'

import { getRunBuildOptions } from '../../../src/lib/build.js'

vi.mock('../../../src/lib/edge-functions/bootstrap.js', () => ({
  getBootstrapURL: () => Promise.resolve('https://example.com/bootstrap'),
}))

const createMockCachedConfig = () => ({
  accounts: [],
  buildDir: '/test',
  env: {},
  repositoryRoot: '/test',
  siteInfo: {
    id: 'site_id',
    account_id: 'account_id',
    feature_flags: {},
  },
  config: {
    build: { base: '/test' },
    plugins: [],
  },
})

describe('getRunBuildOptions', () => {
  test('should use alias as branch when alias is set', async () => {
    const result = await getRunBuildOptions({
      cachedConfig: createMockCachedConfig(),
      currentDir: '/test',
      options: { alias: 'custom-alias' },
    })

    expect(result.branch).toBe('custom-alias')
  })

  test('should leave branch undefined when alias is not set', async () => {
    const result = await getRunBuildOptions({
      cachedConfig: createMockCachedConfig(),
      currentDir: '/test',
      options: {},
    })

    expect(result.branch).toBeUndefined()
  })
})
