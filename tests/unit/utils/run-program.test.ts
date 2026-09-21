import { afterEach, describe, expect, test, vi } from 'vitest'

// ci-info computes `isCI` once at import time; pin it so results don't depend on where this suite runs.
vi.mock('ci-info', () => ({ isCI: false }))

import { CI_FORCED_COMMANDS } from '../../../src/commands/main.js'
import { runProgram } from '../../../src/utils/run-program.js'

const restoreTTYs: (() => void)[] = []

const stubStdinTTY = (isTTY: boolean | undefined) => {
  const original = process.stdin.isTTY
  Object.defineProperty(process.stdin, 'isTTY', { value: isTTY, configurable: true })
  restoreTTYs.push(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: original, configurable: true })
  })
}

const stubScriptedShell = () => {
  stubStdinTTY(undefined)
  vi.stubEnv('CI', undefined)
  vi.stubEnv('TESTING_PROMPTS', undefined)
}

const stubInteractiveShell = () => {
  stubStdinTTY(true)
  vi.stubEnv('CI', undefined)
  vi.stubEnv('TESTING_PROMPTS', undefined)
}

const createProgram = () => {
  const parseAsync = vi.fn().mockResolvedValue(undefined)
  const program = { parseAsync } as unknown as Parameters<typeof runProgram>[0]
  return { program, parseAsync }
}

const run = async (argv: string[]) => {
  const { program, parseAsync } = createProgram()
  await runProgram(program, argv)
  expect(parseAsync).toHaveBeenCalledOnce()
  return parseAsync.mock.calls[0][0] as string[]
}

afterEach(() => {
  restoreTTYs.splice(0).forEach((restore) => {
    restore()
  })
  vi.unstubAllEnvs()
})

describe('runProgram', () => {
  describe('CI-forced commands', () => {
    test.each(Object.keys(CI_FORCED_COMMANDS))('should inject --force for `%s` when scripted', async (cmdName) => {
      stubScriptedShell()
      const argv = ['node', 'netlify', cmdName, 'FOO', 'bar']
      expect(await run(argv)).toEqual(['node', 'netlify', cmdName, 'FOO', 'bar', '--force'])
    })

    test('should inject --force when CI env var is set even if stdin is a TTY', async () => {
      stubInteractiveShell()
      vi.stubEnv('CI', 'true')
      expect(await run(['node', 'netlify', 'env:set', 'FOO', 'bar'])).toEqual([
        'node',
        'netlify',
        'env:set',
        'FOO',
        'bar',
        '--force',
      ])
    })

    test('should not duplicate --force when already present', async () => {
      stubScriptedShell()
      expect(await run(['node', 'netlify', 'env:set', 'FOO', 'bar', '--force'])).toEqual([
        'node',
        'netlify',
        'env:set',
        'FOO',
        'bar',
        '--force',
      ])
    })

    test('should not inject --force when TESTING_PROMPTS is true', async () => {
      stubScriptedShell()
      vi.stubEnv('TESTING_PROMPTS', 'true')
      expect(await run(['node', 'netlify', 'env:set', 'FOO', 'bar'])).toEqual([
        'node',
        'netlify',
        'env:set',
        'FOO',
        'bar',
      ])
    })

    test('should not inject --force when interactive', async () => {
      stubInteractiveShell()
      expect(await run(['node', 'netlify', 'env:set', 'FOO', 'bar'])).toEqual([
        'node',
        'netlify',
        'env:set',
        'FOO',
        'bar',
      ])
    })
  })

  describe('other commands', () => {
    test.each(['link', 'env:list', 'sites:create', 'deploy'])(
      'should never inject --force for `%s` even when scripted',
      async (cmdName) => {
        stubScriptedShell()
        expect(await run(['node', 'netlify', cmdName, '--json'])).toEqual(['node', 'netlify', cmdName, '--json'])
      },
    )
  })
})
