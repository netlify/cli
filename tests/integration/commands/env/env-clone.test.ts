import process from 'process'

import chalk from 'chalk'
import { describe, expect, test, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'

import { log } from '../../../../src/utils/command-helpers.js'
import { generateEnvVarsList } from '../.././../../src/utils/prompts/env-clone-prompt.js'
import { destructiveCommandMessages } from '../.././../../src/utils/prompts/prompt-messages.js'
import { getEnvironmentVariables, withMockApi, setTTYMode, setCI, setTestingPrompts } from '../../utils/mock-api.js'

import { existingVar, routes, secondSiteInfo } from './api-routes.js'
import { runMockProgram } from '../../utils/mock-program.js'
import { mockPrompt, spyOnMockPrompt } from '../../utils/inquirer-mock-prompt.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

const OLD_ENV = process.env

describe('env:clone command', () => {
  describe('prompt messages for env:clone', () => {
    const sharedEnvVars = [existingVar, existingVar]
    const siteIdTwo = secondSiteInfo.id

    const { overwriteNotice } = destructiveCommandMessages
    const { generateWarning, noticeEnvVars, overwriteConfirmation } = destructiveCommandMessages.envClone

    const envVarsList = generateEnvVarsList(sharedEnvVars)
    const warningMessage = generateWarning(siteIdTwo)

    const successMessage = `Successfully cloned environment variables from ${chalk.green('site-name')} to ${chalk.green(
      'site-name-2',
    )}`

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

    describe('user is prompted to confirm when setting an env var that already exists', () => {
      beforeEach(() => {
        setTestingPrompts('true')
      })

      test('should log warnings and prompts if enviroment variable already exists', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = mockPrompt({ confirm: true })

          await runMockProgram(['', '', 'env:clone', '-t', siteIdTwo])

          expect(promptSpy).toHaveBeenCalledWith({
            type: 'confirm',
            name: 'confirm',
            message: expect.stringContaining(overwriteConfirmation),
            default: false,
          })

          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(noticeEnvVars)
          envVarsList.forEach((envVar) => {
            expect(log).toHaveBeenCalledWith(envVar)
          })
          expect(log).toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should skip warnings and prompts if --force flag is passed', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:clone', '--force', '-t', siteIdTwo])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          envVarsList.forEach((envVar) => {
            expect(log).not.toHaveBeenCalledWith(envVar)
          })
          expect(log).not.toHaveBeenCalledWith(noticeEnvVars)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should exit user reponds is no to confirmatnion prompt', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = mockPrompt({ confirm: false })

          try {
            await runMockProgram(['', '', 'env:clone', '-t', siteIdTwo])
          } catch (error) {
            // We expect the process to exit, so this is fine
            expect(error.message).toContain('process.exit unexpectedly called')
          }

          expect(promptSpy).toHaveBeenCalled()

          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(noticeEnvVars)
          envVarsList.forEach((envVar) => {
            expect(log).toHaveBeenCalledWith(envVar)
          })
          expect(log).toHaveBeenCalledWith(overwriteNotice)
          expect(log).not.toHaveBeenCalledWith(successMessage)
        })
      })

      test('should not run prompts if sites have no enviroment variables in common', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))
          const successMessageSite3 = `Successfully cloned environment variables from ${chalk.green(
            'site-name',
          )} to ${chalk.green('site-name-3')}`

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:clone', '-t', 'site_id_3'])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(noticeEnvVars)
          envVarsList.forEach((envVar) => {
            expect(log).not.toHaveBeenCalledWith(envVar)
          })
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessageSite3)
        })
      })
    })

    describe('should not run prompts if in non-interactive shell or CI/CD environment', async () => {
      test('should not show prompt in an non-interactive shell', async () => {
        setTTYMode(false)

        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:clone', '-t', siteIdTwo])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should not show prompt in a ci/cd enviroment', async () => {
        setCI(true)

        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'env:clone', '-t', siteIdTwo])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })
    })
  })
})
