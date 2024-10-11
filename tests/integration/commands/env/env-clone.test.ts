import process from 'process'

import chalk from 'chalk'
import inquirer from 'inquirer'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createEnvCommand } from '../../../../src/commands/env/env.js'
import { log } from '../../../../src/utils/command-helpers.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'

import routes from './api-routes.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

describe('env:clone command', () => {
  setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    test.only<FixtureTestContext>('should create and return new var in the dev context', async ({
      fixture,
      mockApi,
    }) => {
      const cliResponse = await fixture.callCli(['env:clone', '-t', 'site_id_3', '--skip'], {
        offline: false,
        parseJson: false,
      })

      console.log(cliResponse)
      const postRequest = mockApi?.requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/accounts/test-account/env',
      )

      console.log(mockApi?.requests.map((request) => request.method))
      // expect(postRequest.body[0].key).toBe('NEW_VAR')
      // expect(postRequest.body[0].values[0].context).toBe('dev')
      // expect(postRequest.body[0].values[0].value).toBe('new-value')
    })
  })
})

describe('user is prompted to confirm when setting an env var that already exists', () => {
  const sharedEnvVars = 'EXISTING_VAR'
  const siteIdTwo = 'site_id_2'
  const warningMessage = `${chalk.redBright(
    'Warning',
  )}: The following environment variables are already set on the site with ID ${chalk.bgBlueBright(
    siteIdTwo,
  )}. They will be overwritten!`
  const expectedNoticeMessage = `${chalk.yellowBright('Notice')}: The following variables will be overwritten:`

  const expectedSkipMessage = `${chalk.yellowBright(
    'Notice',
  )}: To overwrite the existing variables without confirmation prompts, pass the -s or --skip flag.`
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

      await program.parseAsync(['', '', 'env:clone', '-t', 'site_id_2'])

      expect(promptSpy).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'wantsToSet',
        message: expect.stringContaining('Do you want to proceed with overwriting these variables?'),
        default: false,
      })

      expect(log).toHaveBeenCalledWith(
        `${chalk.redBright(
          'Warning',
        )}: The following environment variables are already set on the site with ID ${chalk.bgBlueBright(
          'site_id_2',
        )}. They will be overwritten!`,
      )

      expect(log).toHaveBeenCalledWith(warningMessage)
      expect(log).toHaveBeenCalledWith(expectedNoticeMessage)
      expect(log).toHaveBeenCalledWith(sharedEnvVars)
      expect(log).toHaveBeenCalledWith(expectedSkipMessage)
      expect(log).toHaveBeenCalledWith(expectedSuccessMessage)
    })
  })

  test('should skip warnings and prompts if -s flag is passed', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const program = new BaseCommand('netlify')
      createEnvCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt')

      await program.parseAsync(['', '', 'env:clone', '-s', '-t', 'site_id_2'])

      expect(promptSpy).not.toHaveBeenCalled()

      expect(log).not.toHaveBeenCalledWith(warningMessage)
      expect(log).not.toHaveBeenCalledWith(expectedNoticeMessage)
      expect(log).not.toHaveBeenCalledWith(sharedEnvVars)
      expect(log).not.toHaveBeenCalledWith(expectedSkipMessage)
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
        await program.parseAsync(['', '', 'env:clone', '-t', 'site_id_2'])
      } catch (error) {
        // We expect the process to exit, so this is fine
        expect(error.message).toContain('process.exit unexpectedly called')
      }

      expect(promptSpy).toHaveBeenCalled()

      expect(log).toHaveBeenCalledWith(warningMessage)
      expect(log).toHaveBeenCalledWith(expectedNoticeMessage)
      expect(log).toHaveBeenCalledWith(sharedEnvVars)
      expect(log).toHaveBeenCalledWith(expectedSkipMessage)
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
      expect(log).not.toHaveBeenCalledWith(expectedNoticeMessage)
      expect(log).not.toHaveBeenCalledWith(sharedEnvVars)
      expect(log).not.toHaveBeenCalledWith(expectedSkipMessage)
      expect(log).toHaveBeenCalledWith(expectedSuccessMessageSite3)
    })
  })
})
