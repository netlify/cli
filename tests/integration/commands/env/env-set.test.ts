import process from 'process'

import chalk from 'chalk'
import { describe, expect, test, vi, beforeEach, afterAll } from 'vitest'

import { log } from '../../../../src/utils/command-helpers.js'
import { destructiveCommandMessages } from '../.././../../src/utils/prompts/prompt-messages.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { getEnvironmentVariables, withMockApi, setTTYMode, setCI, setTestingPrompts } from '../../utils/mock-api.js'
import { runMockProgram } from '../../utils/mock-program.js'
import { routes } from './api-routes.js'
import { mockPrompt, spyOnMockPrompt } from '../../utils/inquirer-mock-prompt.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

const OLD_ENV = process.env

describe('env:set command', () => {
  setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    test<FixtureTestContext>('should create and return new var in the dev context', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        ['env:set', 'NEW_VAR', 'new-value', '--context', 'dev', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
        NEW_VAR: 'new-value',
      })
      const postRequest = mockApi?.requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
      )
      expect(postRequest.body[0].key).toBe('NEW_VAR')
      expect(postRequest.body[0].values[0].context).toBe('dev')
      expect(postRequest.body[0].values[0].value).toBe('new-value')
    })
    test<FixtureTestContext>('should update an existing var in the dev context', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        ['env:set', 'EXISTING_VAR', 'envelope-new-value', '--context', 'dev', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'envelope-new-value',
        OTHER_VAR: 'envelope-all-value',
      })
      const patchRequest = mockApi?.requests.find(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )
      expect(patchRequest.body.value).toBe('envelope-new-value')
      expect(patchRequest.body.context).toBe('dev')
    })
    test<FixtureTestContext>('should support variadic options', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        ['env:set', 'EXISTING_VAR', 'multiple', '--context', 'deploy-preview', 'production', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'multiple',
        OTHER_VAR: 'envelope-all-value',
      })
      const patchRequests = mockApi?.requests.filter(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )
      expect(patchRequests).toHaveLength(2)
      // The order of the request might not be always the same, so we need to find the request
      const dpRequest = patchRequests?.find((request) => request.body.context === 'deploy-preview')
      expect(dpRequest).not.toBeUndefined()
      expect(dpRequest.body.value).toBe('multiple')
      const prodRequest = patchRequests?.find((request) => request.body.context === 'production')
      expect(prodRequest).not.toBeUndefined()
      expect(prodRequest.body.value).toBe('multiple')
    })
    test<FixtureTestContext>('should update existing var without flags', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        ['env:set', 'EXISTING_VAR', 'new-envelope-value', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'new-envelope-value',
        OTHER_VAR: 'envelope-all-value',
      })
      const putRequest = mockApi?.requests.find(
        (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )
      expect(putRequest.body.key).toBe('EXISTING_VAR')
      expect(putRequest.body.values[0].context).toBe('all')
      expect(putRequest.body.values[0].value).toBe('new-envelope-value')
    })
    test<FixtureTestContext>('should set the scope of an existing env var without needing a value', async ({
      fixture,
      mockApi,
    }) => {
      const cliResponse = await fixture.callCli(
        ['env:set', 'EXISTING_VAR', '--scope', 'runtime', 'post-processing', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      })
      const putRequest = mockApi?.requests.find(
        (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )
      expect(putRequest.body.values[0].context).toBe('production')
      expect(putRequest.body.values[1].context).toBe('dev')
      expect(putRequest.body.scopes[0]).toBe('runtime')
      expect(putRequest.body.scopes[1]).toBe('post-processing')
    })
    test<FixtureTestContext>('should create new secret values for multiple contexts', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        [
          'env:set',
          'TOTALLY_NEW_SECRET',
          'shhhhhhecret',
          '--secret',
          '--context',
          'production',
          'deploy-preview',
          'branch-deploy',
          '--json',
          '--force',
        ],
        {
          offline: false,
          parseJson: true,
        },
      )
      expect(cliResponse).toEqual({
        TOTALLY_NEW_SECRET: 'shhhhhhecret',
        EXISTING_VAR: 'envelope-prod-value',
        OTHER_VAR: 'envelope-all-value',
      })
      const postRequest = mockApi?.requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
      )
      expect(postRequest.body).toHaveLength(1)
      expect(postRequest.body[0].key).toBe('TOTALLY_NEW_SECRET')
      expect(postRequest.body[0].is_secret).toBe(true)
      expect(postRequest.body[0].values[0].context).toBe('production')
      expect(postRequest.body[0].values[0].value).toBe('shhhhhhecret')
      expect(postRequest.body[0].values).toHaveLength(3)
    })
    test<FixtureTestContext>('should update a single value for production context', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        ['env:set', 'EXISTING_VAR', 'envelope-new-value', '--secret', '--context', 'production', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'envelope-new-value',
        OTHER_VAR: 'envelope-all-value',
      })
      const patchRequest = mockApi?.requests.find(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )
      expect(patchRequest.body.context).toBe('production')
      expect(patchRequest.body.value).toBe('envelope-new-value')
    })
    test<FixtureTestContext>('should convert an `all` env var to a secret when no value is passed', async ({
      fixture,
      mockApi,
    }) => {
      const cliResponse = await fixture.callCli(['env:set', 'OTHER_VAR', '--secret', '--json', '--force'], {
        offline: false,
        parseJson: true,
      })
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      })
      const putRequest = mockApi?.requests.find(
        (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/OTHER_VAR',
      )
      expect(putRequest.body.is_secret).toBe(true)
      expect(putRequest.body.values.length).toBe(4)
      expect(putRequest.body.values[0].context).toBe('production')
      expect(putRequest.body.values[0].value).toBe('envelope-all-value')
      expect(putRequest.body.values[1].context).toBe('deploy-preview')
      expect(putRequest.body.values[2].context).toBe('branch-deploy')
      expect(putRequest.body.values[3].context).toBe('dev')
      expect(putRequest.body.values[3].value).toBe('')
      expect(putRequest.body.scopes.length).toBe(3)
      expect(putRequest.body.scopes[0]).toBe('builds')
      expect(putRequest.body.scopes[1]).toBe('functions')
      expect(putRequest.body.scopes[2]).toBe('runtime')
    })
    test<FixtureTestContext>('should convert an env var with many values to a secret when no value is passed', async ({
      fixture,
      mockApi,
    }) => {
      const cliResponse = await fixture.callCli(['env:set', 'EXISTING_VAR', '--secret', '--json', '--force'], {
        offline: false,
        parseJson: true,
      })
      expect(cliResponse).toEqual({
        EXISTING_VAR: 'envelope-dev-value',
        OTHER_VAR: 'envelope-all-value',
      })
      const putRequest = mockApi?.requests.find(
        (request) => request.method === 'PUT' && request.path === '/api/v1/accounts/test-account/env/EXISTING_VAR',
      )
      expect(putRequest.body.is_secret).toBe(true)
      expect(putRequest.body.values.length).toBe(2)
      expect(putRequest.body.values[0].context).toBe('production')
      expect(putRequest.body.values[0].value).toBe('envelope-prod-value')
      expect(putRequest.body.values[1].context).toBe('dev')
      expect(putRequest.body.values[1].value).toBe('envelope-dev-value')
      expect(putRequest.body.scopes.length).toBe(2)
      expect(putRequest.body.scopes[0]).toBe('builds')
      expect(putRequest.body.scopes[1]).toBe('functions')
    })
    describe('errors', () => {
      test.concurrent<FixtureTestContext>(
        'should error when a value is passed without --context',
        async ({ fixture }) => {
          await expect(
            fixture.callCli(['env:set', 'TOTALLY_NEW', 'cool-value', '--secret', '--force'], {
              offline: false,
              parseJson: false,
            }),
          ).rejects.toThrowError(`please specify a non-development context`)
        },
      )
      test.concurrent<FixtureTestContext>(
        'should error when set with a post-processing --scope',
        async ({ fixture }) => {
          await expect(
            fixture.callCli(
              ['env:set', 'TOTALLY_NEW', 'cool-value', '--secret', '--scope', 'builds', 'post-processing', '--force'],
              {
                offline: false,
                parseJson: false,
              },
            ),
          ).rejects.toThrowError(`Secret values cannot be used within the post-processing scope.`)
        },
      )
      test.concurrent<FixtureTestContext>(
        'should error when --scope and --context are passed on an existing env var',
        async ({ fixture }) => {
          await expect(
            fixture.callCli(['env:set', 'EXISTING_VAR', '--scope', 'functions', '--context', 'production', '--force'], {
              offline: false,
              parseJson: false,
            }),
          ).rejects.toThrowError(`Setting the context and scope at the same time on an existing env var is not allowed`)
        },
      )
    })
  })

  describe('prompt messages for env:set command', () => {
    const existingVar = 'EXISTING_VAR'
    const newEnvValue = 'value'
    const { overwriteNotice } = destructiveCommandMessages
    const { generateWarning, overwriteConfirmation } = destructiveCommandMessages.envSet

    const warningMessage = generateWarning(existingVar)

    const successMessage = `Set environment variable ${chalk.yellow(
      `${existingVar}=${newEnvValue}`,
    )} in the ${chalk.magenta('all')} context`

    beforeEach(() => {
      vi.resetModules()
      vi.clearAllMocks()

      Object.defineProperty(process, 'env', { value: {} })
    })

    afterAll(() => {
      vi.resetModules()
      vi.restoreAllMocks()

      Object.defineProperty(process, 'env', {
        value: OLD_ENV,
      })
    })
    describe('user is prompted to confirmOverwrite when setting an env var that already exists', () => {
      beforeEach(() => {
        setTestingPrompts('true')
      })

      test('should log warnings and prompts if enviroment variable already exists', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = mockPrompt({ confirm: true })

          await runMockProgram(['', '', 'env:set', existingVar, newEnvValue])

          expect(promptSpy).toHaveBeenCalledWith({
            type: 'confirm',
            name: 'confirm',
            message: expect.stringContaining(overwriteConfirmation),
            default: false,
          })

          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should skip warnings and prompts if enviroment variable does not exist', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:set', 'NEW_ENV_VAR', 'NEW_VALUE'])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(
            `Set environment variable ${chalk.yellow(`${'NEW_ENV_VAR'}=${'NEW_VALUE'}`)} in the ${chalk.magenta(
              'all',
            )} context`,
          )
        })
      })

      test('should skip warnings and prompts if --force flag is passed', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:set', existingVar, newEnvValue, '--force'])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should exit user responds is no to confirmatnion prompt', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = mockPrompt({ confirm: false })

          try {
            await runMockProgram(['', '', 'env:set', existingVar, newEnvValue])
          } catch (error) {
            // We expect the process to exit, so this is fine
            expect(error.message).toContain('process.exit unexpectedly called')
          }

          expect(promptSpy).toHaveBeenCalled()

          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(overwriteNotice)
          expect(log).not.toHaveBeenCalledWith(successMessage)
        })
      })
    })

    describe('prompts should not show in an non-interactive shell or in a ci/cd enviroment', () => {
      test('should not show prompt in an non-interactive shell', async () => {
        setTTYMode(false)

        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:set', existingVar, newEnvValue])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should not show prompt in a ci/cd enviroment', async () => {
        setCI('true')

        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()
          await runMockProgram(['', '', 'env:set', existingVar, newEnvValue])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })
    })
  })
})
