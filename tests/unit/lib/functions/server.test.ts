import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// @ts-expect-error TS(1259) FIXME: Module '"/home/ndhoule/dev/src/github.com/netlify/... Remove this comment to see the full error message
import express from 'express'
import fetch from 'node-fetch'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { FunctionsRegistry } from '../../../../dist/lib/functions/registry.js'
import { createHandler } from '../../../../dist/lib/functions/server.js'
import { getFrameworksAPIPaths } from '../../../../dist/utils/frameworks-api.js'
import StateConfig from '../../../../dist/utils/cli-state.js'

vi.mock('../../../../dist/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../dist/utils/command-helpers.js')),
  log: () => {},
}))

describe('createHandler', () => {
  let server
  let serverAddress
  beforeAll(async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'functions-server-project-root'))
    const functionsDirectory = join(projectRoot, 'functions')
    await mkdir(functionsDirectory)

    const mainFile = join(functionsDirectory, 'hello.js')
    await writeFile(mainFile, `exports.handler = async (event) => ({ statusCode: 200, body: event.rawUrl })`)

    const functionsRegistry = new FunctionsRegistry({
      projectRoot,
      // @ts-expect-error TS(2322) FIXME: Type '{}' is not assignable to type 'NormalizedCac... Remove this comment to see the full error message
      config: {},
      timeouts: { syncFunctions: 1, backgroundFunctions: 1 },
      // @ts-expect-error TS(2322) FIXME: Type '{ port: number; }' is not assignable to type... Remove this comment to see the full error message
      settings: { port: 8888 },
      frameworksAPIPaths: getFrameworksAPIPaths(projectRoot),
    })
    await functionsRegistry.scan([functionsDirectory])
    const app = express()

    // TODO(serhalp): Lazy test type. Create a config factory and use it here.
    app.all(
      '*',
      // @ts-expect-error TS(2741) FIXME: Property 'processing' is missing in type '{}' but ... Remove this comment to see the full error message
      createHandler({ functionsRegistry, config: { dev: {} }, geo: 'mock', state: new StateConfig(projectRoot) }),
    )

    return await new Promise((resolve) => {
      server = app.listen(resolve)
      const { port } = server.address()

      serverAddress = `http://localhost:${port}`
    })
  })

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve)
    })
  })

  test('should get the url as the `rawUrl` inside the function', async () => {
    const response = await fetch(new URL('/.netlify/functions/hello', serverAddress))

    expect(response.status).toBe(200)
    expect(await response.text()).toMatch(/^http:\/\/localhost:\d+?\/.netlify\/functions\/hello$/)
  })

  test(
    'should get the original url as the `rawUrl` when the header was provided by the proxy',
    { retry: 3 },
    async () => {
      const response = await fetch(new URL('/.netlify/functions/hello', serverAddress), {
        headers: { 'x-netlify-original-pathname': '/orig' },
      })

      expect(response.status).toBe(200)
      expect(await response.text()).toMatch(/^http:\/\/localhost:\d+?\/orig$/)
    },
  )

  test('should check if query params are passed to the `rawUrl` when redirected', async () => {
    const response = await fetch(new URL('/.netlify/functions/hello?jam=stack', serverAddress), {
      headers: { 'x-netlify-original-pathname': '/orig' },
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toMatch(/^http:\/\/localhost:\d+?\/orig\?jam=stack$/)
  })
})
