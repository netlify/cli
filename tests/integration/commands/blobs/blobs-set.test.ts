import process from 'process'

import { getStore } from '@netlify/blobs'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { describe, expect, test, vi, beforeEach, afterAll } from 'vitest'

import { log } from '../../../../src/utils/command-helpers.js'
import { destructiveCommandMessages } from '../.././../../src/utils/prompts/prompt-messages.js'
import { reportError } from '../../../../src/utils/telemetry/report-error.js'
import { Route } from '../../utils/mock-api-vitest.js'
import { getEnvironmentVariables, withMockApi, setTTYMode, setCI, setTestingPrompts } from '../../utils/mock-api.js'
import { runMockProgram } from '../../utils/mock-program.js'
import { mockPrompt, spyOnMockPrompt } from '../../utils/inquirer-mock-prompt.js'

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

vi.mock('../../../../src/utils/telemetry/report-error.js', () => ({
  reportError: vi.fn(),
}))

const routes: Route[] = [
  { path: 'sites/site_id', response: siteInfo },

  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
]

const OLD_ENV = process.env

describe('blobs:set command', () => {
  describe('prompt messages for blobs:set command', () => {
    const storeName = 'my-store'
    const key = 'my-key'
    const value = 'my-value'
    const newValue = 'my-new-value'

    const { overwriteNotice } = destructiveCommandMessages
    const { generateWarning, overwriteConfirmation } = destructiveCommandMessages.blobSet

    const warningMessage = generateWarning(key, storeName)

    const successMessage = `${chalk.greenBright('Success')}: Blob ${chalk.yellow(key)} set in store ${chalk.yellow(
      storeName,
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

    describe('user is prompted to confirm when setting a a blob key that already exists', () => {
      beforeEach(() => {
        setTestingPrompts('true')
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

          const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ wantsToSet: true })

          await runMockProgram(['', '', 'blobs:set', storeName, key, value])

          expect(promptSpy).not.toHaveBeenCalled()
          expect(log).toHaveBeenCalledWith(successMessage)
          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
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

          const promptSpy = mockPrompt({ confirm: true })

          await runMockProgram(['', '', 'blobs:set', storeName, key, newValue])

          expect(promptSpy).toHaveBeenCalledWith({
            type: 'confirm',
            name: 'confirm',
            message: expect.stringContaining(overwriteConfirmation),
            default: false,
          })

          expect(log).toHaveBeenCalledWith(successMessage)
          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(overwriteNotice)
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

          const promptSpy = mockPrompt({ confirm: false })

          try {
            await runMockProgram(['', '', 'blobs:set', storeName, key, newValue])
          } catch (error) {
            // We expect the process to exit, so this is fine
            expect(error.message).toContain('process.exit unexpectedly called with "0"')
          }

          expect(promptSpy).toHaveBeenCalledWith({
            type: 'confirm',
            name: 'confirm',
            message: expect.stringContaining(overwriteConfirmation),
            default: false,
          })

          expect(log).toHaveBeenCalledWith(warningMessage)
          expect(log).toHaveBeenCalledWith(overwriteNotice)
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

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'blobs:set', storeName, key, newValue, '--force'])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should log error message if adding a key fails', async () => {
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          const mockSet = vi.fn().mockRejectedValue('')
          vi.mocked(reportError).mockResolvedValue()
          ;(getStore as any).mockReturnValue({
            set: mockSet,
          })

          const promptSpy = spyOnMockPrompt()

          try {
            await runMockProgram(['', '', 'blobs:set', storeName, key, newValue, '--force'])
          } catch (error) {
            expect(error.message).toContain(
              `Could not set blob ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`,
            )
          }

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).not.toHaveBeenCalledWith(successMessage)
        })
      })
    })

    describe('prompts should not show in a non-interactive shell or in a ci/cd enviroment', () => {
      test('should not show prompt in an non-interactive shell', async () => {
        setTTYMode(false)

        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          // Mocking the store.get method to return a value (simulating that the key already exists)
          const mockGet = vi.fn().mockResolvedValue('my-value')
          const mockSet = vi.fn().mockResolvedValue('true')

          ;(getStore as any).mockReturnValue({
            get: mockGet,
            set: mockSet,
          })

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'blobs:set', storeName, key, newValue])

          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })

      test('should not show prompt in a ci/cd environment', async () => {
        setCI(true)
        await withMockApi(routes, async ({ apiUrl }) => {
          Object.assign(process.env, getEnvironmentVariables({ apiUrl }))

          // Mocking the store.get method to return a value (simulating that the key already exists)
          const mockGet = vi.fn().mockResolvedValue('my-value')
          const mockSet = vi.fn().mockResolvedValue('true')

          ;(getStore as any).mockReturnValue({
            get: mockGet,
            set: mockSet,
          })

          const promptSpy = spyOnMockPrompt()

          await runMockProgram(['', '', 'blobs:set', storeName, key, newValue])
          expect(promptSpy).not.toHaveBeenCalled()

          expect(log).not.toHaveBeenCalledWith(warningMessage)
          expect(log).not.toHaveBeenCalledWith(overwriteNotice)
          expect(log).toHaveBeenCalledWith(successMessage)
        })
      })
    })
  })
})
