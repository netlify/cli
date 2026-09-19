import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { RunRecipeOptions } from '../../../../src/commands/recipes/recipes.js'

const { cursorConsumer } = vi.hoisted(() => ({
  cursorConsumer: {
    key: 'cursor',
    presentedName: 'Cursor',
    consumerProcessCmd: 'cursor',
    path: './.cursor/rules',
    ext: 'mdc',
    contextScopes: { serverless: { scope: 'Serverless functions' } },
  },
}))

vi.mock('../../../../src/recipes/ai-context/context.js', () => ({
  NTL_DEV_MCP_FILE_NAME: 'netlify-development.mdc',
  getContextConsumers: vi.fn().mockResolvedValue([cursorConsumer]),
  downloadAndWriteContextFiles: vi.fn().mockResolvedValue(true),
  getExistingContext: vi.fn().mockResolvedValue(null),
  deleteFile: vi.fn(),
}))

vi.mock('../../../../src/utils/command-helpers.js', () => ({
  log: vi.fn(),
  logAndThrowError: vi.fn((error: unknown) => {
    throw error
  }),
  version: '1.0.0',
}))

vi.mock('../../../../src/utils/telemetry/index.js', () => ({
  track: vi.fn(),
}))

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn().mockResolvedValue({ consumerKey: 'cursor' }) },
}))

import { downloadAndWriteContextFiles } from '../../../../src/recipes/ai-context/context.js'
import { run } from '../../../../src/recipes/ai-context/index.js'
import { track } from '../../../../src/utils/telemetry/index.js'

const runRecipe = () => run({ args: [], command: { workingDir: '/project' } } as unknown as RunRecipeOptions)

beforeEach(() => {
  vi.mocked(track).mockClear()
  vi.stubEnv('AI_CONTEXT_SKIP_DETECTION', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('tracks sites_aiContextInstalled with the consumer the context was installed for', async () => {
  await runRecipe()

  expect(track).toHaveBeenCalledWith('sites_aiContextInstalled', { consumer: 'cursor' })
})

test('does not track an install when every context file was already current', async () => {
  vi.mocked(downloadAndWriteContextFiles).mockResolvedValueOnce(false)

  await runRecipe()

  expect(track).not.toHaveBeenCalled()
})

test('does not track an install when writing the context files fails', async () => {
  vi.mocked(downloadAndWriteContextFiles).mockRejectedValueOnce(new Error('download failed'))

  await expect(runRecipe()).rejects.toThrow('download failed')
  expect(track).not.toHaveBeenCalled()
})
