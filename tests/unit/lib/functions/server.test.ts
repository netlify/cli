import http from 'node:http'
import net from 'node:net'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LocalState } from '@netlify/dev-utils'
import express from 'express'

import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { FunctionsRegistry } from '../../../../src/lib/functions/registry.js'
import { createHandler } from '../../../../src/lib/functions/server.js'
import { getFrameworksAPIPaths } from '../../../../src/utils/frameworks-api.js'

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: () => {},
}))

describe('createHandler', () => {
  let server: http.Server
  let serverAddress: string
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
      settings: { functionsPort: 8888 },
      frameworksAPIPaths: getFrameworksAPIPaths(projectRoot),
    })
    await functionsRegistry.scan([functionsDirectory])
    const app = express()

    // TODO(serhalp): Lazy test type. Create a config factory and use it here.
    app.all(
      '*',
      // @ts-expect-error TS(2741) FIXME: Property 'processing' is missing in type '{}' but ... Remove this comment to see the full error message
      createHandler({ functionsRegistry, config: { dev: {} }, geo: 'mock', state: new LocalState(projectRoot) }),
    )

    return await new Promise((resolve) => {
      server = app.listen(resolve)
      const { port } = server.address() as net.AddressInfo

      serverAddress = `http://localhost:${port.toString()}`
    })
  })

  afterAll(async () => {
    await new Promise((resolve) => {
      server.close(resolve)
    })
  })

  test('should get the url as the `rawUrl` inside the function', { retry: 3 }, async () => {
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
