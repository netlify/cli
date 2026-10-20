import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { DEFAULT_CONCURRENT_HASH } from '../../../../src/utils/deploy/constants.js'
import hashFns from '../../../../src/utils/deploy/hash-fns.js'
import { withSiteBuilder } from '../../../integration/utils/site-builder.js'
import { temporaryDirectory } from '../../../../src/utils/temporary-file.js'

test('Hashes files in a folder', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: 'Hello' }),
      })
      .withFunction({
        path: 'goodbye.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: 'Goodbye' }),
      })
      .build()

    const expectedFunctions = ['hello', 'goodbye']
    const { fnShaMap, functions } = await hashFns(new BaseCommand(), [path.join(builder.directory, 'functions')], {
      tmpDir: temporaryDirectory(),
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    expect(Object.entries(functions)).toHaveLength(expectedFunctions.length)
    expect(Object.entries(fnShaMap ?? {})).toHaveLength(expectedFunctions.length)

    expectedFunctions.forEach((functionPath) => {
      const sha = functions[functionPath]
      expect(sha).toBeDefined()

      expect(fnShaMap).toBeDefined()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- FIXME
      const functionsObjArray = fnShaMap![sha]
      functionsObjArray.forEach((fileObj) => {
        expect(fileObj.normalizedPath).toBe(functionPath)
      })
    })
  })
})

test('Populates build_data.bootstrapVersion for v2 functions on direct-zip path', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        runtimeAPIVersion: 2,
        handler: (_req: Request) => new Response('Hello'),
      })
      .build()

    const { fnConfig } = await hashFns(new BaseCommand(), [path.join(builder.directory, 'functions')], {
      tmpDir: temporaryDirectory(),
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      statusCb() {},
    })

    expect(fnConfig).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- covered by expectation above
    const helloConfig = fnConfig!.hello
    expect(helloConfig).toBeDefined()
    expect(helloConfig.build_data).toBeDefined()
    expect(helloConfig.build_data?.runtimeAPIVersion).toBe(2)
    expect(helloConfig.build_data?.bootstrapVersion).toEqual(expect.any(String))
    expect(helloConfig.build_data?.bootstrapVersion).not.toBe('')
  })
})

const withServerEntry = async (builder: { directory: string }) => {
  const serverDir = path.join(builder.directory, 'netlify', 'server')

  await fs.mkdir(serverDir, { recursive: true })
  await fs.writeFile(path.join(serverDir, 'index.mjs'), 'export default () => {}')
}

const hashWithServer = async (builder: { directory: string }, overrides: Record<string, unknown> = {}) =>
  await hashFns(new BaseCommand(), [path.join(builder.directory, 'functions')], {
    tmpDir: temporaryDirectory(),
    concurrentHash: DEFAULT_CONCURRENT_HASH,
    rootDir: builder.directory,
    serverEnabled: true,
    statusCb() {},
    ...overrides,
  })

test('Bundles a Netlify Server when there is no server manifest', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: 'Hello' }),
      })
      .build()
    await withServerEntry(builder)

    const { functions, server, serverShaMap } = await hashWithServer(builder)

    expect(Object.keys(functions)).toEqual(['hello'])
    expect(server?.sha).toMatch(/^[0-9a-f]{64}$/)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- covered above
    expect(Object.keys(serverShaMap!)).toEqual([server!.sha])
  })
})

test('Bundles a Netlify Server for a site with no functions', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder.withNetlifyToml({ config: {} }).build()
    await withServerEntry(builder)

    const { functions, server } = await hashFns(new BaseCommand(), [], {
      tmpDir: temporaryDirectory(),
      concurrentHash: DEFAULT_CONCURRENT_HASH,
      rootDir: builder.directory,
      serverEnabled: true,
      statusCb() {},
    })

    expect(Object.keys(functions)).toHaveLength(0)
    expect(server?.sha).toMatch(/^[0-9a-f]{64}$/)
  })
})

test('Takes the Netlify Server from its own manifest when that is fresh', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder.withNetlifyToml({ config: {} }).build()

    const cachedBundle = path.join(builder.directory, 'cached-server.tgz')
    await fs.writeFile(cachedBundle, 'cached server bundle')

    const serverManifestPath = path.join(builder.directory, 'server-manifest.json')
    await fs.writeFile(
      serverManifestPath,
      JSON.stringify({ server: { path: cachedBundle, region: 'eu-central-1' }, timestamp: Date.now() }),
    )

    const { server } = await hashWithServer(builder, { serverManifestPath })

    expect(server?.region).toBe('eu-central-1')
  })
})

// Checks the server's digest and returns the rest of its fields, to be compared exactly.
const serverFields = <T extends { sha: string }>(server: T | undefined): Omit<T, 'sha'> => {
  expect(server).toBeDefined()

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- covered above
  const { sha, ...fields } = server!

  expect(sha).toMatch(/^[0-9a-f]{64}$/)

  return fields
}

test('Sends the instance size, routes and runtime version from the server manifest', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder.withNetlifyToml({ config: {} }).build()

    const cachedBundle = path.join(builder.directory, 'cached-server.tgz')
    await fs.writeFile(cachedBundle, 'cached server bundle')

    const routes = [
      { pattern: '/api/*', expression: '^/api(?:/(.*))/?$', methods: ['GET', 'POST'], prefer_static: true },
      { pattern: '/health', literal: '/health', prefer_static: true },
    ]
    const excludedRoutes = [{ pattern: '/api/internal', literal: '/api/internal' }]
    const serverManifestPath = path.join(builder.directory, 'server-manifest.json')
    await fs.writeFile(
      serverManifestPath,
      JSON.stringify({
        server: {
          path: cachedBundle,
          region: 'fra',
          instanceSize: 'large',
          routes,
          excludedRoutes,
          runtimeVersion: 'nodejs24.x',
        },
        timestamp: Date.now(),
      }),
    )

    const { server } = await hashWithServer(builder, { serverManifestPath })

    expect(serverFields(server)).toStrictEqual({
      region: 'fra',
      instance_size: 'large',
      routes,
      excluded_routes: excludedRoutes,
      runtime_version: 'nodejs24.x',
    })
  })
})

test('Omits the server fields the manifest does not set', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder.withNetlifyToml({ config: {} }).build()

    const cachedBundle = path.join(builder.directory, 'cached-server.tgz')
    await fs.writeFile(cachedBundle, 'cached server bundle')

    const serverManifestPath = path.join(builder.directory, 'server-manifest.json')
    await fs.writeFile(serverManifestPath, JSON.stringify({ server: { path: cachedBundle }, timestamp: Date.now() }))

    const { server } = await hashWithServer(builder, { serverManifestPath })

    expect(serverFields(server)).toStrictEqual({})
  })
})

test('Bundles the Netlify Server with the server block of the Netlify configuration', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder.withNetlifyToml({ config: {} }).build()
    await withServerEntry(builder)

    const { server } = await hashWithServer(builder, {
      serverConfig: { path: ['/api/*', '/health'], excludedPath: '/api/internal', region: 'fra', size: 'medium' },
    })

    const { routes, excluded_routes: excludedRoutes, runtime_version: runtimeVersion, ...fields } = serverFields(server)

    expect(fields).toStrictEqual({ region: 'fra', instance_size: 'medium' })
    expect(runtimeVersion).toMatch(/^nodejs\d+\.x$/)
    expect(routes).toHaveLength(2)
    expect(routes?.[0]).toMatchObject({ pattern: '/api/*', prefer_static: true })
    expect(routes?.[0]).toHaveProperty('expression')
    expect(routes?.[1]).toStrictEqual({ pattern: '/health', literal: '/health', prefer_static: true })
    expect(excludedRoutes).toStrictEqual([{ pattern: '/api/internal', literal: '/api/internal' }])
  })
})

test('Rebuilds the Netlify Server when its own manifest is expired', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder.withNetlifyToml({ config: {} }).build()
    await withServerEntry(builder)

    const serverManifestPath = path.join(builder.directory, 'server-manifest.json')
    await fs.writeFile(
      serverManifestPath,
      JSON.stringify({
        server: { path: path.join(builder.directory, 'gone.tgz'), region: 'eu-central-1' },
        timestamp: Date.now() - 3 * 60 * 1000,
      }),
    )

    const { server } = await hashWithServer(builder, { serverManifestPath })

    expect(server?.sha).toMatch(/^[0-9a-f]{64}$/)
    expect(server?.region).toBeUndefined()
  })
})

test('Skipping the functions cache does not skip the Netlify Server', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: 'Hello' }),
      })
      .build()
    await withServerEntry(builder)

    const { functions, server } = await hashWithServer(builder, { skipFunctionsCache: true })

    expect(Object.keys(functions)).toEqual(['hello'])
    expect(server?.sha).toMatch(/^[0-9a-f]{64}$/)
  })
})

test('Does not bundle a Netlify Server when the feature is off', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({ config: { functions: { directory: 'functions' } } })
      .withFunction({
        path: 'hello.js',
        handler: async () => Promise.resolve({ statusCode: 200, body: 'Hello' }),
      })
      .build()
    await withServerEntry(builder)

    const { functions, server } = await hashWithServer(builder, { serverEnabled: false })

    expect(Object.keys(functions)).toEqual(['hello'])
    expect(server).toBeUndefined()
  })
})
