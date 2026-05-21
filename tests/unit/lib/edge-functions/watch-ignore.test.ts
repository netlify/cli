import { statSync } from 'fs'
import { join } from 'path'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import type BaseCommand from '../../../../src/commands/base-command.js'
import { EdgeFunctionsRegistryImpl } from '../../../../src/lib/edge-functions/registry.js'
import type { NormalizedCachedConfigConfig } from '../../../../src/utils/command-helpers.js'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, statSync: vi.fn(actual.statSync) }
})

vi.mock('@netlify/dev-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@netlify/dev-utils')>()
  return {
    ...actual,
    watchDebounced: vi.fn().mockResolvedValue({ close: vi.fn(), add: vi.fn(), unwatch: vi.fn() }),
  }
})

// Creates a partial registry via Object.create so the constructor is bypassed,
// then populates the private fields needed by setupWatcherForDirectory.
const makeRegistry = (fields: { projectDir: string; servePath: string; publishDir: string; watchIgnore: string[] }) => {
  const registry = Object.create(EdgeFunctionsRegistryImpl.prototype) as EdgeFunctionsRegistryImpl
  Object.assign(registry, {
    ...fields,
    directoryWatchers: new Map(),
    checkForAddedOrDeletedFunctions: vi.fn(),
    handleFileChange: vi.fn(),
  })
  return registry
}

const captureIgnored = async (registry: EdgeFunctionsRegistryImpl): Promise<(string | RegExp)[]> => {
  const { watchDebounced } = await import('@netlify/dev-utils')
  vi.mocked(watchDebounced).mockClear()
  await (registry as unknown as { setupWatcherForDirectory: () => Promise<void> }).setupWatcherForDirectory()
  const [, options] = vi.mocked(watchDebounced).mock.calls[0]
  return (options as { ignored: (string | RegExp)[] }).ignored
}

describe('toIgnoredRegex', () => {
  // The regex is defined inline in setupWatcherForDirectory. We test it by
  // capturing the ignored array passed to watchDebounced.

  test('matches the directory path itself', async () => {
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/_site',
      watchIgnore: [],
    })
    const ignored = await captureIgnored(registry)
    const servePathRegex = ignored[0] as RegExp
    expect(servePathRegex.test('/project/.netlify/edge-functions-serve')).toBe(true)
  })

  test('matches paths under the directory', async () => {
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/_site',
      watchIgnore: [],
    })
    const ignored = await captureIgnored(registry)
    const publishDirRegex = ignored[1] as RegExp
    expect(publishDirRegex.test('/project/_site/posts/2024/index.html')).toBe(true)
  })

  test('does not match a sibling path that shares a prefix', async () => {
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/_site',
      watchIgnore: [],
    })
    const ignored = await captureIgnored(registry)
    const publishDirRegex = ignored[1] as RegExp
    expect(publishDirRegex.test('/project/_site-backup/index.html')).toBe(false)
  })

  test('escapes special regex characters in the path', async () => {
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/my.build (v2)',
      watchIgnore: [],
    })
    const ignored = await captureIgnored(registry)
    const publishDirRegex = ignored[1] as RegExp
    expect(publishDirRegex.test('/project/my.build (v2)/index.html')).toBe(true)
    expect(publishDirRegex.test('/projectXmyYbuild-v2/index.html')).toBe(false)
  })
})

describe('toIgnoredEntry (watchIgnore entries)', () => {
  beforeEach(() => {
    vi.mocked(statSync).mockReset()
  })

  test('returns a plain string for an existing file', async () => {
    vi.mocked(statSync).mockReturnValue({ isFile: () => true } as ReturnType<typeof statSync>)
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/_site',
      watchIgnore: ['/project/large-data.json'],
    })
    const ignored = await captureIgnored(registry)
    expect(ignored[2]).toBe('/project/large-data.json')
  })

  test('returns a regex for an existing directory', async () => {
    vi.mocked(statSync).mockReturnValue({ isFile: () => false } as ReturnType<typeof statSync>)
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/_site',
      watchIgnore: ['/project/src/posts'],
    })
    const ignored = await captureIgnored(registry)
    expect(ignored[2]).toBeInstanceOf(RegExp)
    expect((ignored[2] as RegExp).test('/project/src/posts/2024/my-post.md')).toBe(true)
  })

  test('returns a regex when the path does not exist yet', async () => {
    vi.mocked(statSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/_site',
      watchIgnore: ['/project/content'],
    })
    const ignored = await captureIgnored(registry)
    expect(ignored[2]).toBeInstanceOf(RegExp)
    expect((ignored[2] as RegExp).test('/project/content/page.md')).toBe(true)
  })
})

describe('internalImportMapPath is kept as a plain string', () => {
  test('import map path is passed as an exact-match string, not a regex', async () => {
    const registry = makeRegistry({
      projectDir: '/project',
      servePath: '/project/.netlify/edge-functions-serve',
      publishDir: '/project/_site',
      watchIgnore: [],
    })
    const ignored = await captureIgnored(registry)
    // servePath regex, publishDir regex, internalImportMapPath string
    const importMapEntry = ignored[2]
    expect(typeof importMapEntry).toBe('string')
    expect(importMapEntry).toBe(join('/project', '.netlify', 'edge-functions-import-map.json'))
  })
})

describe('constructor path resolution', () => {
  const makeOptions = (overrides: { publishDir?: string; watchIgnore?: string[] } = {}) => ({
    aiGatewayContext: null,
    bundler: { find: vi.fn().mockResolvedValue([]) } as unknown as typeof import('@netlify/edge-bundler'),
    command: { netlify: { config: { build: {} } }, workingDir: '/project' } as unknown as BaseCommand,
    config: { edge_functions: [], functions: { '*': {} } } as unknown as NormalizedCachedConfigConfig,
    configPath: '/project/netlify.toml',
    debug: false,
    env: {},
    featureFlags: {},
    getUpdatedConfig: vi.fn(),
    projectDir: '/project',
    publishDir: overrides.publishDir ?? '_site',
    runIsolate: vi.fn() as unknown as Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>,
    servePath: '/project/.netlify/edge-functions-serve',
    watchIgnore: overrides.watchIgnore ?? [],
    deployEnvironment: [],
  })

  beforeEach(() => {
    vi.spyOn(
      EdgeFunctionsRegistryImpl.prototype as unknown as { doInitialScan: () => Promise<void> },
      'doInitialScan',
    ).mockResolvedValue(undefined)
    vi.spyOn(
      EdgeFunctionsRegistryImpl.prototype as unknown as { setupWatchers: () => Promise<void> },
      'setupWatchers',
    ).mockResolvedValue(undefined)
  })

  type RegistryPrivateState = { publishDir: string; watchIgnore: string[] }

  test('resolves a relative publishDir against projectDir', () => {
    const registry = new EdgeFunctionsRegistryImpl(makeOptions({ publishDir: '_site' }))
    expect((registry as unknown as RegistryPrivateState).publishDir).toBe('/project/_site')
  })

  test('keeps an absolute publishDir unchanged', () => {
    const registry = new EdgeFunctionsRegistryImpl(makeOptions({ publishDir: '/other/_site' }))
    expect((registry as unknown as RegistryPrivateState).publishDir).toBe('/other/_site')
  })

  test('resolves relative watchIgnore paths against projectDir', () => {
    const registry = new EdgeFunctionsRegistryImpl(makeOptions({ watchIgnore: ['src/posts', 'content'] }))
    expect((registry as unknown as RegistryPrivateState).watchIgnore).toEqual([
      '/project/src/posts',
      '/project/content',
    ])
  })

  test('keeps absolute watchIgnore paths unchanged', () => {
    const registry = new EdgeFunctionsRegistryImpl(
      makeOptions({ watchIgnore: ['/absolute/src/posts', '/other/content'] }),
    )
    expect((registry as unknown as RegistryPrivateState).watchIgnore).toEqual(['/absolute/src/posts', '/other/content'])
  })

  test('handles a mix of relative and absolute watchIgnore paths', () => {
    const registry = new EdgeFunctionsRegistryImpl(makeOptions({ watchIgnore: ['src/posts', '/absolute/content'] }))
    expect((registry as unknown as RegistryPrivateState).watchIgnore).toEqual([
      '/project/src/posts',
      '/absolute/content',
    ])
  })
})
