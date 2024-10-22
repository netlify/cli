import process from 'process'

import chalk from 'chalk'
import inquirer from 'inquirer'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createEnvCommand } from '../../../../src/commands/env/index.js'
import { log } from '../../../../src/utils/command-helpers.js'
import { generateEnvVarsList } from '../../../../src/utils/prompts/env-clone-prompt.js'
import { destructiveCommandMessages } from '../../../../src/utils/prompts/prompt-messages.js'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'

import { existingVar, routes, secondSiteInfo } from './api-routes.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

describe('env:clone command', () => {
  describe('user is prompted to confirm when setting an env var that already exists', () => {
    const sharedEnvVars = [existingVar, existingVar]
    const siteIdTwo = secondSiteInfo.id

    const { overwriteNoticeMessage } = destructiveCommandMessages
    const { generateWarningMessage, noticeEnvVarsMessage, overwriteConfirmationMessage } =
      destructiveCommandMessages.envClone

    const envVarsList = generateEnvVarsList(sharedEnvVars)
    const warningMessage = generateWarningMessage(siteIdTwo)

    const expectedSuccessMessage = `Successfully cloned environment variables from ${chalk.green(
      'site-name',
    )} to ${chalk.green('site-name-2')}`

    beforeEach(() => {
      vi.resetAllMocks()
    })

    test('should log warnings and prompts if enviroment variable already exists', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        createEnvCommand(program)

        const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ wantsToSet: true })

        await program.parseAsync(['', '', 'env:clone', '-t', siteIdTwo])

        expect(promptSpy).toHaveBeenCalledWith({
          type: 'confirm',
          name: 'wantsToSet',
          message: expect.stringContaining(overwriteConfirmationMessage),
          default: false,
        })

        expect(log).toHaveBeenCalledWith(warningMessage)
        expect(log).toHaveBeenCalledWith(noticeEnvVarsMessage)
        envVarsList.forEach((envVar) => {
          expect(log).toHaveBeenCalledWith(envVar)
        })
        expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
        expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
      })
    })

    test('should skip warnings and prompts if --force flag is passed', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        createEnvCommand(program)

        const promptSpy = vi.spyOn(inquirer, 'prompt')

        await program.parseAsync(['', '', 'env:clone', '--force', '-t', siteIdTwo])

        expect(promptSpy).not.toHaveBeenCalled()

        expect(log).not.toHaveBeenCalledWith(warningMessage)
        envVarsList.forEach((envVar) => {
          expect(log).not.toHaveBeenCalledWith(envVar)
        })
        expect(log).not.toHaveBeenCalledWith(noticeEnvVarsMessage)
        expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
        expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
      })
    })

    test('should exit user reponds is no to confirmatnion prompt', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        createEnvCommand(program)

        const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ wantsToSet: false })

        try {
          await program.parseAsync(['', '', 'env:clone', '-t', siteIdTwo])
        } catch (error) {
          // We expect the process to exit, so this is fine
          expect(error.message).toContain('process.exit unexpectedly called')
        }

        expect(promptSpy).toHaveBeenCalled()

        expect(log).toHaveBeenCalledWith(warningMessage)
        expect(log).toHaveBeenCalledWith(noticeEnvVarsMessage)
        envVarsList.forEach((envVar) => {
          expect(log).toHaveBeenCalledWith(envVar)
        })
        expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
        expect(log).not.toHaveBeenCalledWith(expectedSuccessMessage)
      })
    })

    test('should not run prompts if sites have no enviroment variables in common', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))
        const expectedSuccessMessageSite3 = `Successfully cloned environment variables from ${chalk.green(
          'site-name',
        )} to ${chalk.green('site-name-3')}`

        const program = new BaseCommand('netlify')
        createEnvCommand(program)

        const promptSpy = vi.spyOn(inquirer, 'prompt')

        await program.parseAsync(['', '', 'env:clone', '-t', 'site_id_3'])

        expect(promptSpy).not.toHaveBeenCalled()

        expect(log).not.toHaveBeenCalledWith(warningMessage)
        expect(log).not.toHaveBeenCalledWith(noticeEnvVarsMessage)
        envVarsList.forEach((envVar) => {
          expect(log).not.toHaveBeenCalledWith(envVar)
        })
        expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
        expect(log).toHaveBeenCalledWith(expectedSuccessMessageSite3)
      })
    })
  })
})
