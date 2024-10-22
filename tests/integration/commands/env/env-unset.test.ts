import process from 'process'

import chalk from 'chalk'
import inquirer from 'inquirer'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createEnvCommand } from '../../../../src/commands/env/env.js'
import { log } from '../../../../src/utils/command-helpers.js'
import { destructiveCommandMessages } from '../../../../src/utils/prompts/prompt-messages.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'

import routes from './api-routes.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

describe('env:unset command', () => {
  setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    test<FixtureTestContext>('should remove existing variable', async ({ fixture, mockApi }) => {
      const cliResponse = await fixture.callCli(['env:unset', '--json', 'EXISTING_VAR', '--force'], {
        offline: false,
        parseJson: true,
      })

      expect(cliResponse).toEqual({
        OTHER_VAR: 'envelope-all-value',
      })

      const deleteRequest = mockApi?.requests.find((request) => request.method === 'DELETE')

      expect(deleteRequest.path).toBe('/api/v1/accounts/test-account/env/EXISTING_VAR')
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

      expect(deleteRequest.path).toBe('/api/v1/accounts/test-account/env/EXISTING_VAR/value/1234')
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

      expect(deleteRequest.path).toBe('/api/v1/accounts/test-account/env/OTHER_VAR/value/3456')

      const patchRequests = mockApi?.requests.filter(
        (request) => request.method === 'PATCH' && '/api/v1/accounts/test-account/env/OTHER_VAR',
      )

      expect(patchRequests).toHaveLength(3)
    })
  })

  describe('user is prompted to confirm when unsetting an env var that already exists', () => {
    // already exists as value in withMockApi
    const existingVar = 'EXISTING_VAR'

    const { overwriteNoticeMessage } = destructiveCommandMessages
    const { generateWarningMessage, overwriteConfirmationMessage } = destructiveCommandMessages.envUnset

    const warningMessage = generateWarningMessage(existingVar)

    const expectedSuccessMessage = `Unset environment variable ${chalk.yellow(`${existingVar}`)} in the ${chalk.magenta(
      'all',
    )} context`

    beforeEach(() => {
      vi.resetAllMocks()
    })

    test('should log warnings and prompts if enviroment variable already exists', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        createEnvCommand(program)

        const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ wantsToSet: true })

        await program.parseAsync(['', '', 'env:unset', existingVar])

        expect(promptSpy).toHaveBeenCalledWith({
          type: 'confirm',
          name: 'wantsToSet',
          message: expect.stringContaining(overwriteConfirmationMessage),
          default: false,
        })

        expect(log).toHaveBeenCalledWith(warningMessage)
        expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
        expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
      })
    })

    test('should skip warnings and prompts if -f flag is passed', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        createEnvCommand(program)

        const promptSpy = vi.spyOn(inquirer, 'prompt')

        await program.parseAsync(['', '', 'env:unset', existingVar, '-f'])

        expect(promptSpy).not.toHaveBeenCalled()

        expect(log).not.toHaveBeenCalledWith(warningMessage)
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
          await program.parseAsync(['', '', 'env:unset', existingVar])
        } catch (error) {
          // We expect the process to exit, so this is fine
          expect(error.message).toContain('process.exit unexpectedly called')
        }

        expect(promptSpy).toHaveBeenCalled()

        expect(log).toHaveBeenCalledWith(warningMessage)
        expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
        expect(log).not.toHaveBeenCalledWith(expectedSuccessMessage)
      })
    })

    test('should not run prompts if enviroment variable does not exist', async () => {
      await withMockApi(routes, async ({ apiUrl }) => {
        Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

        const program = new BaseCommand('netlify')
        createEnvCommand(program)

        const promptSpy = vi.spyOn(inquirer, 'prompt')

        await program.parseAsync(['', '', 'env:unset', 'NEW_ENV_VAR'])

        expect(promptSpy).not.toHaveBeenCalled()

        expect(log).not.toHaveBeenCalledWith(warningMessage)
        expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
        expect(log).not.toHaveBeenCalledWith(expectedSuccessMessage)
      })
    })
  })
})
