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

describe('blob:set command', () => {
  const storeName = 'my-store'
  const key = 'my-key'
  const value = 'my-value'
  const newValue = 'my-new-value'

  const { overwriteNoticeMessage } = destructiveCommandMessages
  const { generateWarningMessage, overwriteConfirmationMessage } = destructiveCommandMessages.blobSet

  const warningMessage = generateWarningMessage(key, storeName)

  const boldKey = chalk.bold(key)

  const successMessage = `${chalk.greenBright('Success')}: Blob ${chalk.yellow(key)} set in store ${chalk.yellow(
    storeName,
  )}`

  beforeEach(() => {
    vi.resetAllMocks()
  })

  test('should not log warnings and prompt if blob key does not exist', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const mockGet = vi.fn().mockResolvedValue('')
      const mockSet = vi.fn().mockResolvedValue('true')

      ;(getStore as any).mockReturnValue({
        get: mockGet,
        set: mockSet,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ wantsToSet: true })

      await program.parseAsync(['', '', 'blob:set', storeName, key, value])

      expect(promptSpy).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(successMessage)
      expect(log).not.toHaveBeenCalledWith(warningMessage)
      expect(log).not.toHaveBeenCalledWith(boldKey)
      expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
    })
  })

  test('should log warnings and prompt if blob key already exists', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      // Mocking the store.get method to return a value (simulating that the key already exists)
      const mockGet = vi.fn().mockResolvedValue(value)
      const mockSet = vi.fn().mockResolvedValue('true')

      ;(getStore as any).mockReturnValue({
        get: mockGet,
        set: mockSet,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ confirm: true })

      await program.parseAsync(['', '', 'blob:set', storeName, key, newValue])

      expect(promptSpy).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirm',
        message: expect.stringContaining(overwriteConfirmationMessage),
        default: false,
      })

      expect(log).toHaveBeenCalledWith(successMessage)
      expect(log).toHaveBeenCalledWith(warningMessage)
      expect(log).toHaveBeenCalledWith(boldKey)
      expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
    })
  })

  test('should exit if user responds with no to confirmation prompt', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      // Mocking the store.get method to return a value (simulating that the key already exists)
      const mockGet = vi.fn().mockResolvedValue('my-value')
      const mockSet = vi.fn().mockResolvedValue('true')

      ;(getStore as any).mockReturnValue({
        get: mockGet,
        set: mockSet,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ confirm: false })

      try {
        await program.parseAsync(['', '', 'blob:set', storeName, key, newValue])
      } catch (error) {
        // We expect the process to exit, so this is fine
        expect(error.message).toContain('process.exit unexpectedly called with "0"')
      }

      expect(promptSpy).toHaveBeenCalledWith({
        type: 'confirm',
        name: 'confirm',
        message: expect.stringContaining(overwriteConfirmationMessage),
        default: false,
      })

      expect(log).toHaveBeenCalledWith(warningMessage)
      expect(log).toHaveBeenCalledWith(boldKey)
      expect(log).toHaveBeenCalledWith(overwriteNoticeMessage)
      expect(log).not.toHaveBeenCalledWith(successMessage)
    })
  })

  test('should not log warnings and prompt if blob key already exists and --force flag is passed', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      // Mocking the store.get method to return a value (simulating that the key already exists)
      const mockGet = vi.fn().mockResolvedValue('my-value')
      const mockSet = vi.fn().mockResolvedValue('true')

      ;(getStore as any).mockReturnValue({
        get: mockGet,
        set: mockSet,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt')

      await program.parseAsync(['', '', 'blob:set', storeName, key, newValue, '--force'])

      expect(promptSpy).not.toHaveBeenCalled()

      expect(log).not.toHaveBeenCalledWith(warningMessage)
      expect(log).not.toHaveBeenCalledWith(boldKey)
      expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
      expect(log).toHaveBeenCalledWith(successMessage)
    })
  })

  test('should log error message if adding a key fails', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

      const mockSet = vi.fn().mockRejectedValue('')

      ;(getStore as any).mockReturnValue({
        set: mockSet,
      })

      const program = new BaseCommand('netlify')
      createBlobsCommand(program)

      const promptSpy = vi.spyOn(inquirer, 'prompt')

      try {
        await program.parseAsync(['', '', 'blob:set', storeName, key, newValue, '--force'])
      } catch (error) {
        expect(error.message).toContain(`Could not set blob ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`)
      }

      expect(promptSpy).not.toHaveBeenCalled()

      expect(log).not.toHaveBeenCalledWith(warningMessage)
      expect(log).not.toHaveBeenCalledWith(overwriteNoticeMessage)
      expect(log).not.toHaveBeenCalledWith(successMessage)
    })
  })
})
