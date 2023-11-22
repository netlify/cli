import path from 'path'

import mock from 'mock-fs'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { getPathInHome } from '../src/lib/settings'

import { addMockedFiles, clearMockedFiles, mockFiles } from './fs'
import { server } from './server'

global.stdOut = ''
global.stdErr = ''

vi.spyOn(console, 'log').mockImplementation((message) => (global.stdOut += `${message}\n`))

// eslint-disable-next-line n/prefer-global/process
vi.spyOn(process.stdout, 'write').mockImplementation((buffer) => {
  global.stdOut += typeof buffer === 'string' ? buffer : buffer.toString()
  return true
})

// eslint-disable-next-line n/prefer-global/process
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

// eslint-disable-next-line n/prefer-global/process
vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new ProcessExitError(code ?? 0)
})

afterEach(() => {
  global.stdOut = ''
  global.stdErr = ''
  server.resetHandlers()

  clearMockedFiles()
})

// eslint-disable-next-line workspace/no-process-cwd, n/prefer-global/process
const nodeModules = mock.load(path.resolve(process.cwd(), 'node_modules'), {})

beforeEach((context) => {
  const configPath = getPathInHome(['config.json'])

  context.callCli = async (args: string[]) => {
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
    // eslint-disable-next-line workspace/no-process-cwd, n/prefer-global/process
    'package.json': mock.load(path.resolve(process.cwd(), 'package.json'), {}),
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
  }
}
