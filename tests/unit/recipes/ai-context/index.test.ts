import { afterEach, expect, test, vi } from 'vitest'

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
  downloadAndWriteContextFiles: vi.fn().mockResolvedValue(undefined),
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

import { run } from '../../../../src/recipes/ai-context/index.js'
import { track } from '../../../../src/utils/telemetry/index.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('tracks sites_aiContextInstalled with the consumer the context was installed for', async () => {
  vi.stubEnv('AI_CONTEXT_SKIP_DETECTION', 'true')

  await run({ args: [], command: { workingDir: '/project' } } as unknown as RunRecipeOptions)

  expect(track).toHaveBeenCalledWith('sites_aiContextInstalled', { consumer: 'cursor' })
})
