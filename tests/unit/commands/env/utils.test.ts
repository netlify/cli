import { describe, expect, test, vi, beforeEach, afterEach, type MockInstance } from 'vitest'

const { jsonMessages } = vi.hoisted(() => ({ jsonMessages: [] as unknown[] }))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
  exit: (code = 0): never => {
    throw new Error(`process.exit(${String(code)})`)
  },
}))

import { failNotLinked, getEnvSiteId } from '../../../../src/commands/env/utils.js'
import type BaseCommand from '../../../../src/commands/base-command.js'

const createMockCommand = ({ linkedSiteId, flagSiteId }: { linkedSiteId?: string; flagSiteId?: string }) =>
  ({
    netlify: {
      site: { id: linkedSiteId },
      siteInfo: { id: flagSiteId },
    },
  }) as unknown as BaseCommand

describe('getEnvSiteId', () => {
  test('returns the linked site id when --site is not passed', () => {
    const command = createMockCommand({ linkedSiteId: 'linked-id' })

    expect(getEnvSiteId({}, command)).toBe('linked-id')
  })

  test('returns the resolved siteInfo id when --site is passed', () => {
    const command = createMockCommand({ linkedSiteId: 'linked-id', flagSiteId: 'flag-id' })

    expect(getEnvSiteId({ site: 'my-project' }, command)).toBe('flag-id')
  })

  test('returns undefined when unlinked and --site is not passed', () => {
    const command = createMockCommand({})

    expect(getEnvSiteId({}, command)).toBeUndefined()
  })
})

describe('failNotLinked', () => {
  let stderrSpy: MockInstance<typeof process.stderr.write>

  beforeEach(() => {
    jsonMessages.length = 0
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
  })

  test('prints a NOT_LINKED JSON envelope to stdout and exits non-zero with --json', () => {
    expect(() => failNotLinked({ json: true })).toThrowError('process.exit(1)')

    expect(jsonMessages).toHaveLength(1)
    expect(jsonMessages[0]).toEqual({
      error: {
        code: 'NOT_LINKED',
        message: 'No project id found, please run inside a project folder or `netlify link`',
        fix: 'netlify link',
      },
    })
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  test('prints prose to stderr and exits non-zero without --json', () => {
    expect(() => failNotLinked({})).toThrowError('process.exit(1)')

    expect(jsonMessages).toHaveLength(0)
    expect(stderrSpy).toHaveBeenCalledWith(
      'No project id found, please run inside a project folder or `netlify link`\n',
    )
  })

  test('uses the provided message override', () => {
    expect(() => failNotLinked({}, 'custom message')).toThrowError('process.exit(1)')

    expect(stderrSpy).toHaveBeenCalledWith('custom message\n')
  })
})
