/* eslint-disable @typescript-eslint/no-unsafe-call */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import type { ConsumerConfig } from '../../../../src/recipes/ai-context/context.js'
import type { RunRecipeOptions } from '../../../../src/commands/recipes/recipes.js'

// Mock fs module
vi.mock('node:fs', () => {
  return {
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockImplementation(() => {
        const err = new Error('File not found') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      }),
      readFile: vi.fn(),
      rm: vi.fn().mockResolvedValue(undefined),
    },
  }
})

// Set up global fetch mock
const mockFetch = vi.fn()
const originalFetch = globalThis.fetch;

// Mock command helpers
vi.mock('../../../../src/utils/command-helpers.js', () => {
  const log = vi.fn()
  const logAndThrowError = vi.fn((msg) => {
    throw new Error(msg as string)
  })

  return {
    log,
    logAndThrowError,
    chalk: { underline: (text: string) => text },
    version: '1.0.0',
  }
})

// Import modules after mocks are defined
import { promises as fs } from 'node:fs'
import { downloadAndWriteContextFiles } from '../../../../src/recipes/ai-context/context.js'

describe('downloadAndWriteContextFiles', () => {
  // Setup test data
  const mockConsumer: ConsumerConfig = {
    key: 'test-consumer',
    presentedName: 'Test Consumer',
    path: './test-path',
    ext: 'mdc',
    contextScopes: {
      serverless: {
        scope: 'Serverless functions',
        shared: ['shared/compute-globals'],
        endpoint: 'https://docs.netlify.com/ai-context/scoped-context?scopes=serverless',
      },
      'edge-functions': {
        scope: 'Edge functions',
        shared: ['shared/compute-globals'],
        endpoint: 'https://docs.netlify.com/ai-context/scoped-context?scopes=edge-functions',
      },
    },
  }

  const mockRunOptions = {
    command: {
      workingDir: '/test/dir',
    },
  } as RunRecipeOptions

  const mockProviderContent = '<ProviderContext version="1.0" provider="Netlify">Test content</ProviderContext>'

  const fetchRespImpl = {
    ok: true,
    text: () => Promise.resolve(),
    json: () => Promise.resolve(),
    headers: { get: (header: string) => (header === 'x-cli-min-ver' ? '0.5.0' : null) },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch
    mockFetch.mockResolvedValue({
      ...fetchRespImpl,
      text: () => Promise.resolve(mockProviderContent),
      json: () => Promise.resolve({ consumers: [] }),
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  test('downloads and writes context files for all scopes', async () => {
    // Execute the actual function
    await downloadAndWriteContextFiles(mockConsumer, mockRunOptions)

    // Verify expected calls
    expect(mockFetch).toHaveBeenCalledTimes(2) // Once for each scope
    expect(fs.writeFile).toHaveBeenCalledTimes(2) // Once for each scope

    // Verify file paths and content
    expect(fs.writeFile).toHaveBeenCalledWith('/test/dir/test-path/netlify-serverless.mdc', mockProviderContent)
    expect(fs.writeFile).toHaveBeenCalledWith('/test/dir/test-path/netlify-edge-functions.mdc', mockProviderContent)
  })

  test('handles existing files with same version', async () => {
    // Mock existing file with same version
    //
    // @ts-expect-error mocking is not 100% consistent with full API and types for
    fs.stat.mockResolvedValue({ isFile: () => true } as () => boolean)
    // @ts-expect-error mocking is not 100% consistent with full API and types for
    fs.readFile.mockResolvedValue(mockProviderContent)

    // Execute the actual function
    await downloadAndWriteContextFiles(mockConsumer, mockRunOptions)

    // Verify expected behavior - no writes when versions match
    expect(fs.writeFile).not.toHaveBeenCalled()
  })

  test('applies overrides when updating existing Netlify files', async () => {
    // Mock existing file with different version
    const existingContent =
      '<ProviderContext version="0.9" provider="Netlify">Old content<ProviderContextOverrides>Custom overrides</ProviderContextOverrides></ProviderContext>'
    // @ts-expect-error mocking is not 100% consistent with full API and types for
    fs.stat.mockResolvedValue({ isFile: () => true } as () => boolean)
    // @ts-expect-error mocking is not 100% consistent with full API and types for
    fs.readFile.mockResolvedValue(existingContent)

    // Execute the actual function
    await downloadAndWriteContextFiles(mockConsumer, mockRunOptions)

    // Verify file was updated with overrides applied
    expect(fs.writeFile).toHaveBeenCalledTimes(2)
  })

  test('handles truncation when content exceeds limit', async () => {
    // Create long content
    const longContent =
      '<ProviderContext version="1.0" provider="Netlify">' +
      Math.random().toString().repeat(1000) +
      '</ProviderContext>'
    mockFetch.mockResolvedValue({
      ...fetchRespImpl,
      text: () => Promise.resolve(longContent),
      json: () => Promise.resolve({ consumers: [] }),
    })

    // Add truncation limit to consumer
    const consumerWithLimit = {
      ...mockConsumer,
      truncationLimit: 100,
    }

    // Execute the actual function
    await downloadAndWriteContextFiles(consumerWithLimit, mockRunOptions)

    // Verify content was truncated
    const writeFileCalls = vi.mocked(fs.writeFile).mock.calls
    expect(writeFileCalls.length).toBeGreaterThan(0)

    // Check that all written content is truncated
    writeFileCalls.forEach((call) => {
      // @ts-expect-error mocking is not 100% consistent with full API and types for
      expect(call[1].length).toBeLessThanOrEqual(100)
    })
  })

  test('uses custom file extension when specified', async () => {
    // Create consumer with custom extension
    const consumerWithCustomExt = {
      ...mockConsumer,
      ext: 'json', // Custom extension instead of default 'mdc'
    }

    // Execute the actual function
    await downloadAndWriteContextFiles(consumerWithCustomExt, mockRunOptions)

    // Verify file paths have the custom extension
    expect(fs.writeFile).toHaveBeenCalledWith('/test/dir/test-path/netlify-serverless.json', mockProviderContent)
    expect(fs.writeFile).toHaveBeenCalledWith('/test/dir/test-path/netlify-edge-functions.json', mockProviderContent)
  })

  test('handles download errors gracefully', async () => {
    // Mock fetch to return not ok
    // @ts-expect-error mocking is not 100% consistent with full API and types for
    fetch.mockResolvedValue({
      ok: false,
    } as Response)

    // Execute the actual function and expect error
    await expect(downloadAndWriteContextFiles(mockConsumer, mockRunOptions)).resolves.toBeUndefined()
  })

  test('checks CLI version compatibility', async () => {
    // Set higher minimum CLI version
    // @ts-expect-error mocking is not 100% consistent with full API and types for
    fetch.mockResolvedValue({
      ok: true,
      headers: {
        get: (header: string) => {
          if (header === 'x-cli-min-ver') return '2.0.0' // Higher than the mocked current version
          return null
        },
      },
    } as Response)

    // Execute the actual function and expect error
    await expect(downloadAndWriteContextFiles(mockConsumer, mockRunOptions)).resolves.toBeUndefined()
  })
})
