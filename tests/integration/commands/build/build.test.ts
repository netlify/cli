import { http, HttpResponse } from 'msw'
import { describe, test, expect, beforeEach } from 'vitest'

import { addMockedFiles } from '../../../fs.ts'
import { server } from '../../../server.ts'

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
}
const siteInfoWithCommand = {
  ...siteInfo,
  id: 'site_id_with_command',
  build_settings: {
    cmd: 'echo uiCommand',
  },
}

describe('command/build', () => {
  beforeEach(() => {
    server.use(
      http.get('https://api.netlify.com/api/v1/accounts', () => HttpResponse.json([{ slug: 'test-account' }])),
      http.get('https://api.netlify.com/api/v1/sites', () => HttpResponse.json([])),
      http.get('https://api.netlify.com/api/v1/sites/:site_id', ({ params }) => {
        if (params.site_id === 'site_id_with_command') {
          return HttpResponse.json(siteInfoWithCommand)
        }

        return HttpResponse.json(siteInfo)
      }),
      http.get('https://api.netlify.com/api/v1/sites/:site_id/service-instances', () => HttpResponse.json([])),
    )

    addMockedFiles({
      '.netlify': {
        'state.json': JSON.stringify({
          siteId: 'site_id',
        }),
      },
    })
  })

  test('should print output for a successful command', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: 'echo "hello world"',
      },
    })

    const { exitCode, stdout } = await callCli(['build'])
    expect(stdout).toContain('hello world')
    expect(exitCode).toBe(0)
  })

  test('should execute build plugins', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: 'echo "build build build"',
      },
    })
    builder.addPlugin('basic')

    const { exitCode, stdout } = await callCli(['build'])
    expect(stdout).toContain('hello world')
    expect(stdout).toContain('build build build')
    expect(exitCode).toBe(0)
  })

  test('should use build command from UI', async ({ builder, callCli }) => {
    builder.setSiteId('site_id_with_command')

    const { exitCode, stdout } = await callCli(['build'])

    expect(stdout).toContain('uiCommand')
    expect(exitCode).toBe(0)
  })

  test('should print output for a failed command', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: 'doesNotExist',
      },
    })

    const { exitCode, stdout } = await callCli(['build'])

    expect(stdout).toContain('doesNotExist')
    expect(exitCode).toBe(2)
  })

  test('should run in dry mode when the --dry flag is set', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
    })

    const { exitCode, stdout } = await callCli(['build', '--dry'])
    expect(stdout).toContain('If this looks good to you')
    expect(stdout).not.toContain('testCommand')
    expect(exitCode).toBe(0)
  })

  test('should run the production context when context is not defined', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
      context: {
        production: {
          command: 'echo testProduction',
        },
      },
    })

    const { exitCode, stdout } = await callCli(['build', '--offline'])
    expect(stdout).toContain('testProduction')
    expect(exitCode).toBe(0)
  })

  test('should run the staging context command when the --context option is set to staging', async ({
    builder,
    callCli,
  }) => {
    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
      context: {
        staging: {
          command: 'echo testStaging',
        },
      },
    })

    const { exitCode, stdout } = await callCli(['build', '--offline', '--context=staging'])
    expect(stdout).toContain('testStaging')
    expect(exitCode).toBe(0)
  })

  test('should run the staging context command when the context env variable is set', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
      context: {
        staging: {
          command: 'echo testStaging',
        },
      },
    })

    // eslint-disable-next-line n/prefer-global/process
    Object.assign(process.env, { CONTEXT: 'staging' })

    const { exitCode, stdout } = await callCli(['build', '--offline'])

    expect(stdout).toContain('testStaging')
    expect(exitCode).toBe(0)
  })

  test('should print debug information when the --debug flag is set', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
    })

    const { exitCode, stdout } = await callCli(['build', '--debug'])
    expect(stdout).toContain('Resolved config')
    expect(exitCode).toBe(0)
  })

  test('should use root directory netlify.toml when runs in subdirectory', async ({ builder, callCli }) => {
    builder.setConfigPath('../netlify.toml')
    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
    })

    const { exitCode, stdout } = await callCli(['build'])
    expect(stdout).toContain('testCommand')
    expect(exitCode).toBe(0)
  })

  test('should error when using invalid netlify.toml', async ({ builder, callCli }) => {
    builder.setConfig({
      build: {
        command: false as any,
      },
    })

    const { exitCode, stderr } = await callCli(['build'])

    expect(stderr).toContain('Invalid syntax')
    expect(exitCode).toBe(1)
  })

  test('should error when a site id is missing', async ({ builder, callCli }) => {
    builder.setSiteId('')

    const { exitCode, stderr } = await callCli(['build'])

    expect(stderr).toContain('Could not find the site ID')
    expect(exitCode).toBe(1)
  })

  test('should not require a linked site when offline flag is set', async ({ builder, callCli }) => {
    builder.setSiteId('')

    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
    })
    const { exitCode, stdout } = await callCli(['build', '--offline'])

    expect(stdout).not.toContain('No Netlify site linked')
    expect(stdout).toContain('testCommand')
    expect(exitCode).toBe(0)
  })

  test('should not send network requests when offline flag is set', async ({ builder, callCli }) => {
    const requests: any[] = []
    server.events.on('request:start', (req) => requests.push(req))

    builder.setConfig({
      build: {
        command: 'echo testCommand',
      },
    })

    const { exitCode, stdout } = await callCli(['build', '--offline'])
    server.events.removeAllListeners('request:start')

    expect(stdout).toContain('testCommand')
    expect(exitCode).toBe(0)
    expect(requests.length).toBe(0)
  })
})
