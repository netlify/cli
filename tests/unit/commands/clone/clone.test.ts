import { resolve } from 'path'

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { getCredentialHelper } from '../../../../src/commands/clone/clone.js'

describe('clone command', () => {
  describe('getCredentialHelper', () => {
    const originalArgv1 = process.argv[1]

    beforeEach(() => {
      vi.stubEnv('npm_lifecycle_event', undefined)
      vi.stubEnv('npm_config_user_agent', undefined)
      vi.stubEnv('npm_command', undefined)
      process.argv[1] = '/some/path/to/bin/run.js'
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      process.argv[1] = originalArgv1
    })

    it('pins the resolved node + script path when invoked directly', () => {
      expect(getCredentialHelper()).toBe(
        `!'${process.execPath}' '${resolve('/some/path/to/bin/run.js')}' git-credential`,
      )
    })

    it('falls back to `npx netlify` when invoked via npx, since argv[1] points into a temp cache dir', () => {
      vi.stubEnv('npm_lifecycle_event', 'npx')

      expect(getCredentialHelper()).toBe('!npx netlify git-credential')
    })

    it('falls back to `pnpm exec netlify` when invoked via pnpm exec', () => {
      vi.stubEnv('npm_config_user_agent', 'pnpm/8.0.0 npm/? node/v18.0.0')
      vi.stubEnv('npm_command', 'exec')

      expect(getCredentialHelper()).toBe('!pnpm exec netlify git-credential')
    })
  })
})
