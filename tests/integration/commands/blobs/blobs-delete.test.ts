import process from 'process'

import { getStore } from '@netlify/blobs'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { describe, expect, test, vi, beforeEach } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createBlobsCommand } from '../../../../src/commands/blobs/blobs.js'
import { log } from '../../../../src/utils/command-helpers.js'
import { destructiveCommandMessages } from '../../../../src/utils/prompts/prompt-messages.js'
import { Route } from '../../utils/mock-api-vitest.js'
import { getEnvironmentVariables, withMockApi } from '../../utils/mock-api.js'

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  feature_flags: {
    edge_functions_npm_support: true,
  },
  functions_config: { timeout: 1 },
}

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

vi.mock('@netlify/blobs', () => ({
  getStore: vi.fn(),
}))

const routes: Route[] = [
  { path: 'sites/site_id', response: siteInfo },

  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]

describe('blob:delete command', () => {
  const storeName = 'my-store'
  const key = 'my-key'

  const { overwriteNoticeMessage } = destructiveCommandMessages
  const { generateWarningMessage, overwriteConfirmationMessage } = destructiveCommandMessages.blobDelete

  const warningMessage = generateWarningMessage(key, storeName)

  const successMessage = `${chalk.greenBright('Success')}: Blob ${chalk.yellow(key)} deleted from store ${chalk.yellow(
    storeName,
  )}`

  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('should log warning message and prompt for confirmation', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const mockDelete = vi.fn().mockResolvedValue('true')

      ;(getStore as any).mockReturnValue({
        delete: mockDelete,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ confirm: true })

      await program.parseAsync(['', '', 'blob:delete', storeName, key])

      expect(promptSpy).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirm',
        message: expect.stringContaining(overwriteConfirmationMessage),
        default: false,
      })

      expect(log).toHaveBeenCalledWith(warningMessage)
      expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
      expect(log).toHaveBeenCalledWith(successMessage)
    })
  })

  test('should exit if user responds with no to confirmation prompt', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const mockDelete = vi.fn().mockResolvedValue('true')

      ;(getStore as any).mockReturnValue({
        delete: mockDelete,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ confirm: false })

      try {
        await program.parseAsync(['', '', 'blob:delete', storeName, key])
      } catch (error) {
        // We expect the process to exit, so this is fine
        expect(error.message).toContain('process.exit unexpectedly called')
      }

      expect(promptSpy).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirm',
        message: expect.stringContaining(overwriteConfirmationMessage),
        default: false,
      })

      expect(log).toHaveBeenCalledWith(warningMessage)
      expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
      expect(log).not.toHaveBeenCalledWith(successMessage)
    })
  })

  test('should not log warning message and prompt for confirmation if --force flag is passed', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const mockDelete = vi.fn().mockResolvedValue('true')

      ;(getStore as any).mockReturnValue({
        delete: mockDelete,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt')

      await program.parseAsync(['', '', 'blob:delete', storeName, key, '--force'])

      expect(promptSpy).not.toHaveBeenCalled()

      expect(log).not.toHaveBeenCalledWith(warningMessage)
      expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
      expect(log).toHaveBeenCalledWith(successMessage)
    })
  })

  test('should log error message if delete fails', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const mockDelete = vi.fn().mockRejectedValue('')

      ;(getStore as any).mockReturnValue({
        delete: mockDelete,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt')

      try {
        await program.parseAsync(['', '', 'blob:delete', storeName, key, '--force'])
      } catch (error) {
        expect(error.message).toContain(
          `Could not delete blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`,
        )
      }

      expect(promptSpy).not.toHaveBeenCalled()

      expect(log).not.toHaveBeenCalledWith(warningMessage)
      expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
      expect(log).not.toHaveBeenCalledWith(successMessage)
    })
  })
})
