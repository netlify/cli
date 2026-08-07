import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

import { describe, expect, test, vi } from 'vitest'

import type BaseCommand from '../../../../src/commands/base-command.js'
import { EdgeFunctionsRegistryImpl } from '../../../../src/lib/edge-functions/registry.js'
import { MultiMap } from '../../../../src/utils/multimap.js'

vi.mock('@netlify/dev-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@netlify/dev-utils')>()
  return {
    ...actual,
    watchDebounced: vi.fn().mockResolvedValue({ close: vi.fn(), add: vi.fn(), unwatch: vi.fn() }),
  }
})

const projectDir = resolve('/project')
const userFunctionsDir = join(projectDir, 'netlify', 'edge-functions')
const internalFunctionsDir = join(projectDir, '.netlify', 'edge-functions')
const frameworkFunctionsDir = join(projectDir, '.netlify', 'v1', 'edge-functions')
const functionPath = join(userFunctionsDir, 'func1.ts')
const insideDependencyPath = join(userFunctionsDir, 'helper.ts')
const outsideDependencyPath = join(projectDir, 'shared', 'util.ts')
const staleDependencyPath = join(projectDir, 'old-dep.ts')

const makeCommand = (name = 'dev') =>
  ({
    name: () => name,
    workingDir: projectDir,
    netlify: {
      config: { build: { edge_functions: userFunctionsDir } },
      frameworksAPIPaths: { edgeFunctions: { path: frameworkFunctionsDir } },
    },
  } as unknown as BaseCommand)

const makeRegistry = (overrides: Record<string, unknown> = {}) => {
  const registry = Object.create(EdgeFunctionsRegistryImpl.prototype) as EdgeFunctionsRegistryImpl
  Object.assign(registry, {
    command: makeCommand(),
    projectDir,
    servePath: join(projectDir, '.netlify', 'edge-functions-serve'),
    publishDir: join(projectDir, '_site'),
    watchIgnore: [],
    configPath: '',
    internalFunctions: [],
    userFunctions: [],
    functionPaths: new Map<string, string>(),
    dependencyPaths: new MultiMap<string, string>(),
    watchedDependencyPaths: new Set<string>(),
    checkForAddedOrDeletedFunctions: vi.fn(),
    handleFileChange: vi.fn(),
    ...overrides,
  })
  return registry
}

type RegistryInternals = {
  setupWatchers: () => Promise<void>
  processGraph: (graph: unknown) => void
  watchedDependencyPaths: Set<string>
}

const asInternals = (registry: EdgeFunctionsRegistryImpl) => registry as unknown as RegistryInternals

describe('setupWatchers', () => {
  test('watches the edge function directories and not the project directory', async () => {
    const { watchDebounced } = await import('@netlify/dev-utils')
    vi.mocked(watchDebounced).mockClear()

    const registry = makeRegistry()
    await asInternals(registry).setupWatchers()

    const watchedTargets = vi.mocked(watchDebounced).mock.calls.map(([target]) => target)
    expect(watchedTargets).not.toContainEqual(projectDir)

    const directoriesTarget = watchedTargets.find((target) => Array.isArray(target))
    expect(directoriesTarget).toEqual(expect.arrayContaining([internalFunctionsDir, userFunctionsDir]))
    expect(directoriesTarget).not.toContain(projectDir)
  })

  test('includes the frameworks API directory when running serve', async () => {
    const { watchDebounced } = await import('@netlify/dev-utils')
    vi.mocked(watchDebounced).mockClear()

    const registry = makeRegistry({ command: makeCommand('serve') })
    await asInternals(registry).setupWatchers()

    const directoriesTarget = vi
      .mocked(watchDebounced)
      .mock.calls.map(([target]) => target)
      .find(Array.isArray)
    expect(directoriesTarget).toContain(frameworkFunctionsDir)
  })
})

describe('dependency watching', () => {
  const makeGraph = (dependencyPaths: string[]) => ({
    modules: [
      {
        specifier: pathToFileURL(functionPath).href,
        dependencies: dependencyPaths.map((path) => ({ code: { specifier: pathToFileURL(path).href } })),
      },
      ...dependencyPaths.map((path) => ({ specifier: pathToFileURL(path).href, dependencies: [] })),
    ],
  })

  const makeRegistryWithWatcher = () => {
    const functionsWatcher = {
      add: vi.fn<(path: string) => void>(),
      unwatch: vi.fn<(path: string) => void>(),
      close: vi.fn(),
    }
    const registry = makeRegistry({
      functionsWatcher,
      functionPaths: new Map([[functionPath, 'func1']]),
    })
    return { registry, functionsWatcher }
  }

  test('watches dependencies that live outside the edge function directories', () => {
    const { registry, functionsWatcher } = makeRegistryWithWatcher()

    asInternals(registry).processGraph(makeGraph([outsideDependencyPath]))

    const addedPaths = functionsWatcher.add.mock.calls.flatMap(([path]) => path)
    expect(addedPaths).toContain(outsideDependencyPath)
  })

  test('does not explicitly watch dependencies inside the edge function directories', () => {
    const { registry, functionsWatcher } = makeRegistryWithWatcher()

    asInternals(registry).processGraph(makeGraph([insideDependencyPath]))

    const addedPaths = functionsWatcher.add.mock.calls.flatMap(([path]) => path)
    expect(addedPaths).not.toContain(insideDependencyPath)
  })

  test('unwatches dependencies that are no longer part of the graph', () => {
    const { registry, functionsWatcher } = makeRegistryWithWatcher()
    asInternals(registry).watchedDependencyPaths = new Set([staleDependencyPath])

    asInternals(registry).processGraph(makeGraph([outsideDependencyPath]))

    const unwatchedPaths = functionsWatcher.unwatch.mock.calls.flatMap(([path]) => path)
    expect(unwatchedPaths).toContain(staleDependencyPath)
  })

  test('keeps watching dependencies that remain in the graph', () => {
    const { registry, functionsWatcher } = makeRegistryWithWatcher()
    asInternals(registry).watchedDependencyPaths = new Set([outsideDependencyPath])

    asInternals(registry).processGraph(makeGraph([outsideDependencyPath]))

    expect(functionsWatcher.unwatch).not.toHaveBeenCalled()
    const addedPaths = functionsWatcher.add.mock.calls.flatMap(([path]) => path)
    expect(addedPaths).not.toContain(outsideDependencyPath)
  })
})
