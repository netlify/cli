import type { NetlifyConfig } from '@netlify/build'
import { describe, expect, test } from 'vitest'

import { normalizeFunctionsConfig } from '../../../../src/lib/functions/config.js'

describe('normalizeFunctionsConfig', () => {
  test('normalizes the catch-all entry and each function pattern', () => {
    const normalized = normalizeFunctionsConfig({
      functionsConfig: {
        '*': { node_bundler: 'esbuild' },
        'my-function': { included_files: ['data/**'] },
      },
      projectRoot: '/project',
    })

    expect(Object.keys(normalized)).toEqual(['*', 'my-function'])
    expect(normalized['*']).toMatchObject({ nodeBundler: 'esbuild_zisi', includedFilesBasePath: '/project' })
    expect(normalized['my-function']).toMatchObject({ includedFiles: ['data/**'], includedFilesBasePath: '/project' })
  })

  test('adds a normalized catch-all entry when the config has none', () => {
    const normalized = normalizeFunctionsConfig({
      functionsConfig: { 'my-function': {} } as unknown as NetlifyConfig['functions'],
      projectRoot: '/project',
    })

    expect(Object.keys(normalized)).toEqual(['*', 'my-function'])
    expect(normalized['*']).toMatchObject({ includedFilesBasePath: '/project', zipGo: true })
  })
})
