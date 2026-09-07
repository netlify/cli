import { describe, expect, test, vi, beforeEach } from 'vitest'

const { logMessages, jsonMessages } = vi.hoisted(() => {
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { logMessages, jsonMessages }
})

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
  exit: vi.fn(),
}))

vi.mock('../../../../src/utils/scripted-commands.js', () => ({
  isInteractive: vi.fn().mockReturnValue(false),
}))

import { printResults, printUploadedAssets } from '../../../../src/commands/deploy/deploy.js'
import type { UploadFile } from '../../../../src/utils/deploy/upload-files.js'

const makeResults = (overrides: object = {}) => ({
  siteId: 'site-123',
  siteName: 'my-site',
  deployId: 'deploy-456',
  siteUrl: 'https://my-site.netlify.app',
  deployUrl: 'https://deploy-456--my-site.netlify.app',
  logsUrl: 'https://app.netlify.com/projects/my-site/deploys/deploy-456',
  functionLogsUrl: 'https://app.netlify.com/logs/functions',
  edgeFunctionLogsUrl: 'https://app.netlify.com/logs/edge-functions',
  sourceZipFileName: undefined,
  uploadList: [] as UploadFile[],
  ...overrides,
})

const staticFile = (path: string): UploadFile => ({
  assetType: 'file',
  filepath: `/build${path}`,
  normalizedPath: path,
})

const functionFile = (name: string): UploadFile => ({
  assetType: 'function',
  filepath: `/functions/${name}.zip`,
  normalizedPath: name,
})

const edgeFunctionFile = (name: string): UploadFile => ({
  assetType: 'edge-function',
  filepath: `/edge-functions/${name}.js`,
  normalizedPath: name,
  hash: 'abc123',
})

beforeEach(() => {
  logMessages.length = 0
  jsonMessages.length = 0
})

describe('printUploadedAssets', () => {
  test('prints grouped static files, functions, and edge functions', () => {
    const uploadList: UploadFile[] = [
      staticFile('/index.html'),
      staticFile('/styles/main.css'),
      functionFile('api'),
      edgeFunctionFile('transform'),
    ]

    printUploadedAssets(uploadList)

    const output = logMessages.join('\n')
    expect(output).toContain('Uploaded assets (4 total)')
    expect(output).toContain('Static files (2)')
    expect(output).toContain('/index.html')
    expect(output).toContain('/styles/main.css')
    expect(output).toContain('Functions (1)')
    expect(output).toContain('api')
    expect(output).toContain('Edge functions (1)')
    expect(output).toContain('transform')
  })

  test('prints (none) for each empty group', () => {
    printUploadedAssets([])

    const output = logMessages.join('\n')
    expect(output).toContain('Uploaded assets (0 total)')
    expect(output).toContain('Static files (0)')
    expect(output).toContain('Functions (0)')
    expect(output).toContain('Edge functions (0)')
    expect(output.match(/\(none\)/g)?.length).toBe(3)
  })

  test('prints only static files when no functions or edge functions uploaded', () => {
    const uploadList: UploadFile[] = [staticFile('/index.html'), staticFile('/about.html')]

    printUploadedAssets(uploadList)

    const output = logMessages.join('\n')
    expect(output).toContain('Static files (2)')
    expect(output).toContain('Functions (0)')
    expect(output).toContain('Edge functions (0)')
    expect(output).not.toContain('(none)\n    /index.html')
  })
})

describe('printResults', () => {
  const baseParams = {
    deployToProduction: false,
    uploadSourceZip: false,
    runBuildCommand: true,
  }

  describe('--show-uploaded not set', () => {
    test('does not print upload section in non-interactive mode', () => {
      printResults({
        ...baseParams,
        json: false,
        results: makeResults({ uploadList: [staticFile('/index.html')] }),
        showUploaded: false,
      })

      const output = logMessages.join('\n')
      expect(output).not.toContain('Uploaded assets')
      expect(output).not.toContain('/index.html')
    })

    test('does not include uploaded keys in JSON output', () => {
      printResults({
        ...baseParams,
        json: true,
        results: makeResults({ uploadList: [staticFile('/index.html')] }),
        showUploaded: false,
      })

      expect(jsonMessages).toHaveLength(1)
      const data = jsonMessages[0] as Record<string, unknown>
      expect(data).not.toHaveProperty('uploaded_files')
      expect(data).not.toHaveProperty('uploaded_functions')
      expect(data).not.toHaveProperty('uploaded_edge_functions')
    })
  })

  describe('--show-uploaded set', () => {
    test('prints upload section in non-interactive mode', () => {
      printResults({
        ...baseParams,
        json: false,
        results: makeResults({
          uploadList: [staticFile('/index.html'), functionFile('api')],
        }),
        showUploaded: true,
      })

      const output = logMessages.join('\n')
      expect(output).toContain('Uploaded assets (2 total)')
      expect(output).toContain('/index.html')
      expect(output).toContain('api')
    })

    test('prints upload section with empty list in non-interactive mode', () => {
      printResults({
        ...baseParams,
        json: false,
        results: makeResults({ uploadList: [] }),
        showUploaded: true,
      })

      const output = logMessages.join('\n')
      expect(output).toContain('Uploaded assets (0 total)')
      expect(output.match(/\(none\)/g)?.length).toBe(3)
    })

    test('includes uploaded_files, uploaded_functions, uploaded_edge_functions in JSON output', () => {
      printResults({
        ...baseParams,
        json: true,
        results: makeResults({
          uploadList: [staticFile('/index.html'), functionFile('api'), edgeFunctionFile('transform')],
        }),
        showUploaded: true,
      })

      expect(jsonMessages).toHaveLength(1)
      const data = jsonMessages[0] as Record<string, unknown>
      expect(data.uploaded_files).toEqual(['/index.html'])
      expect(data.uploaded_functions).toEqual(['api'])
      expect(data.uploaded_edge_functions).toEqual(['transform'])
    })

    test('includes empty arrays in JSON output when nothing was uploaded', () => {
      printResults({
        ...baseParams,
        json: true,
        results: makeResults({ uploadList: [] }),
        showUploaded: true,
      })

      expect(jsonMessages).toHaveLength(1)
      const data = jsonMessages[0] as Record<string, unknown>
      expect(data.uploaded_files).toEqual([])
      expect(data.uploaded_functions).toEqual([])
      expect(data.uploaded_edge_functions).toEqual([])
    })

    test('JSON output still includes standard deploy fields', () => {
      printResults({
        ...baseParams,
        json: true,
        results: makeResults(),
        showUploaded: true,
      })

      expect(jsonMessages).toHaveLength(1)
      const data = jsonMessages[0] as Record<string, unknown>
      expect(data).toHaveProperty('site_id', 'site-123')
      expect(data).toHaveProperty('deploy_id', 'deploy-456')
      expect(data).toHaveProperty('deploy_url')
      expect(data).toHaveProperty('logs')
    })
  })
})
