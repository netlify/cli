import process from 'process'

import { describe, expect, test, vi, beforeEach, afterAll } from 'vitest'

import { chalk, log } from '../../../../src/utils/command-helpers.js'
import { destructiveCommandMessages } from '../.././../../src/utils/prompts/prompt-messages.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { getEnvironmentVariables, withMockApi, setTTYMode, setCI, setTestingPrompts } from '../../utils/mock-api.js'

import { routes } from './api-routes.js'
import { runMockProgram } from '../../utils/mock-program.js'
import { mockPrompt, spyOnMockPrompt } from '../../utils/inquirer-mock-prompt.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

const OLD_ENV = process.env

describe('env:unset command', async () => {
  await setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    test<FixtureTestContext>('should remove existing variable', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(['env:unset', '--json', 'EXISTING_VAR', '--force'], {
        offline: false,
        parseJson: true,
      })

      expect(cliResponse).toEqual({
        OTHER_VAR: 'envelope-all-value',
      })

      const deleteRequest = mockApi?.requests.find((request) => request.method === 'DELETE')

      expect(deleteRequest).toHaveProperty('path', '/api/v1/accounts/test-account/env/EXISTING_VAR')
    })

    test<FixtureTestContext>('should remove existing variable value', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        ['env:unset', 'EXISTING_VAR', '--context', 'production', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )

      expect(cliResponse).toEqual({
        OTHER_VAR: 'envelope-all-value',
      })

      const deleteRequest = mockApi?.requests.find((request) => request.method === 'DELETE')

      expect(deleteRequest).toHaveProperty('path', '/api/v1/accounts/test-account/env/EXISTING_VAR/value/1234')
    })

    test<FixtureTestContext>('should split up an `all` value', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(
        ['env:unset', 'OTHER_VAR', '--context', 'branch-deploy', '--json', '--force'],
        {
          offline: false,
          parseJson: true,
        },
      )

      expect(cliResponse).toEqual({})

      const deleteRequest = mockApi?.requests.find((request) => request.method === 'DELETE')

      expect(deleteRequest).toHaveProperty('path', '/api/v1/accounts/test-account/env/OTHER_VAR/value/3456')

      const patchRequests = mockApi?.requests.filter(
        (request) => request.method === 'PATCH' && request.path === '/api/v1/accounts/test-account/env/OTHER_VAR',
      )

      expect(patchRequests).toHaveLength(4)
    })
  })

  describe('prompt messages for env:unset command', () => {
    const { overwriteNotice } = destructiveCommandMessages
    const { generateWarning, overwriteConfirmation } = destructiveCommandMessages.envUnset

    // already exists as value in withMockApi
    const existingVar = 'EXISTING_VAR'
    const warningMessage = generateWarning(existingVar)
    const expectedSuccessMessage = `Unset environment variable ${chalk.yellow(existingVar)} in the ${chalk.magenta(
      'all',
    )} context`

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

    describe('user is prompted to confirm when unsetting an env var that already exists', () => {
      beforeEach(() => {
        setTestingPrompts('true')
      })

      test('should log warnings and prompts if enviroment variable already exists', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = mockPrompt({ confirm: true })

          await runMockProgram(['', '', 'env:unset', existingVar])

          expect(promptSpy).toHaveBeenCalledWith({
            type: 'confirm',
            name: 'confirm',
            message: expect.stringContaining(overwriteConfirmation),
            default: false,
          })

          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
        })
      })

      test('should skip warnings and prompts if --force flag is passed', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:unset', existingVar, '--force'])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
        })
      })

      test('should exit user reponds is no to confirmatnion prompt', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = mockPrompt({ confirm: false })

          try {
            await runMockProgram(['', '', 'env:unset', existingVar])
          } catch (error) {
            // We expect the process to exit, so this is fine
            expect(error).toBeInstanceOf(Error)
            expect((error as Error).message).toContain('process.exit unexpectedly called')
          }

          expect(promptSpy).toHaveBeenCalled()

          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(overwriteNotice)
          expect(log).not.toHaveBeenCalledWith(expectedSuccessMessage)
        })
      })

      test('should not run prompts if enviroment variable does not exist', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:unset', 'NEW_ENV_VAR'])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).not.toHaveBeenCalledWith(expectedSuccessMessage)
        })
      })
    })

    describe('prompts should not show in an non-interactive shell or in a ci/cd enviroment', () => {
      test('prompts should not show in an non-interactive shell', async () => {
        setTTYMode(false)

        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:unset', existingVar])
          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
        })
      })

      test('prompts should not show in a ci/cd enviroment', async () => {
        setCI('true')

        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:unset', existingVar])
          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
        })
      })
    })
  })
})
