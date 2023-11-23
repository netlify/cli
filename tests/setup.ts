/* eslint-disable n/prefer-global/process */
/* eslint-disable workspace/no-process-cwd */
import path from 'path'

import mock from 'mock-fs'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { getPathInHome } from '../src/lib/settings'

import { StateBuilder } from './builder.js'
import { addMockedFiles, clearMockedFiles, mockFiles } from './fs'
import { server } from './server'

global.stdOut = ''
global.stdErr = ''

vi.spyOn(console, 'log').mockImplementation((message) => (global.stdOut += `${message}\n`))

vi.spyOn(process.stdout, 'write').mockImplementation((buffer) => {
  global.stdOut += typeof buffer === 'string' ? buffer : buffer.toString()
  return true
})

vi.spyOn(process.stderr, 'write').mockImplementation((buffer) => {
  global.stdErr += typeof buffer === 'string' ? buffer : buffer.toString()
  return true
})

class ProcessExitError extends Error {
  constructor(public exitCode: number) {
    super(`Process exited with code ${exitCode}`)
    this.name = 'ProcessExitError'
  }
}

vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new ProcessExitError(code ?? 0)
})

afterEach(() => {
  global.stdOut = ''
  global.stdErr = ''
  server.resetHandlers()

  clearMockedFiles()
})

const nodeModules = mock.load(path.resolve(process.cwd(), 'node_modules'), {})

beforeEach((context) => {
  const configPath = getPathInHome(['config.json'])
  const builder = new StateBuilder()

  context.builder = builder
  context.callCli = async (args: string[]) => {
    builder.build()
    mockFiles()
    const { createMainCommand } = await import('../src/commands/index.js')
    const program = createMainCommand()

    let exitCode = 0
    try {
      await program.parseAsync(['', '', ...args])
    } catch (error) {
      if (error instanceof ProcessExitError) {
        // eslint-disable-next-line prefer-destructuring
        exitCode = error.exitCode
      } else {
        exitCode = 1
        global.stdErr += error.message
      }
    }

    return {
      stdout: global.stdOut,
      stderr: global.stdErr,
      exitCode,
    }
  }

  addMockedFiles({
    node_modules: nodeModules,
    'package.json': mock.load(path.resolve(process.cwd(), 'package.json'), {}),
    tests: {
      plugins: mock.load(path.resolve(process.cwd(), 'tests/plugins'), {}),
    },
    [configPath]: JSON.stringify({
      clidId: 'cli-id',
      userId: 'user-id',
      users: {
        'user-id': {
          id: 'user-id',
          name: 'Test User',
          email: 'test-user@netlify.com',
          auth: {
            token: 'test-token',
          },
        },
      },
    }),
  })
})

beforeAll(() => {
  server.listen()
})

afterAll(() => {
  server.close()
  mock.restore()
})

declare module 'vitest' {
  export interface TestContext {
    callCli: (args: string[]) => Promise<{
      stdout: string
      stderr: string
      exitCode: number
    }>
    builder: StateBuilder
  }
}
