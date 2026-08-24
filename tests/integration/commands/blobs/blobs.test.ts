import { readFile, rm } from 'fs/promises'
import { join } from 'path'
import { env } from 'process'

import { ListResultBlob } from '@netlify/blobs'
import { BlobsServer } from '@netlify/blobs/server'
import httpProxy from 'http-proxy'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { Route } from '../../utils/mock-api-vitest.js'
import { temporaryDirectory } from '../../../../src/utils/temporary-file.js'

const blobsProxy = httpProxy.createProxyServer({})

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  feature_flags: {
    edge_functions_npm_support: true,
  },
  functions_config: { timeout: 1 },
}

describe('blobs:* commands', () => {
  const directory = temporaryDirectory()

  let server: BlobsServer
  const routes: Route[] = [
    { path: 'sites/site_id', response: siteInfo },

    { path: 'sites/site_id/service-instances', response: [] },
    {
      path: 'accounts',
      response: [{ slug: siteInfo.account_slug }],
    },
  ]

  beforeAll(async () => {
    server = new BlobsServer({
      debug: true,
      directory,
      token: 'fake-token',
    })

    const address = await server.start()

    routes.push({
      method: 'all',
      path: 'blobs/{*splat}',
      response: (req, res) => {
        blobsProxy.web(req, res, { target: `http://localhost:${address.port}` })
      },
    })
  })

  afterAll(async () => {
    await server.stop()

    if (!env.CI) {
      await rm(directory, { force: true, recursive: true })
    }
  })

  setupFixtureTests('empty-project', { mockApi: { routes } }, () => {
    const expectedSucusesMessage = 'Success: Blob my-key set in store my-store'

    test<FixtureTestContext>('should set, get, list, and delete blobs', async ({ fixture }) => {
      expect(
        await fixture.callCli(['blobs:set', 'my-store', 'my-key', 'Hello world', '--force'], {
          offline: false,
        }),
      ).toBe(expectedSucusesMessage)

      expect(
        await fixture.callCli(['blobs:get', 'my-store', 'my-key'], {
          offline: false,
        }),
      ).toBe('Hello world')

      const outputPath = join(temporaryDirectory(), 'my-file.txt')

      expect(
        await fixture.callCli(['blobs:get', 'my-store', 'my-key', '--output', outputPath], {
          offline: false,
        }),
      ).toBe('')
      expect(await readFile(outputPath, 'utf8')).toBe('Hello world')

      const listResult = await fixture.callCli(['blobs:list', 'my-store', '--json'], {
        offline: false,
        parseJson: true,
      })
      const blobs = listResult.blobs as ListResultBlob[]

      expect(blobs.length).toBe(1)
      expect(blobs[0].etag).toBeTruthy()
      expect(blobs[0].key).toBe('my-key')
      expect(listResult.directories).toEqual([])

      expect(
        await fixture.callCli(['blobs:delete', 'my-store', 'my-key', '--force'], {
          offline: false,
        }),
      ).toBe('Success: Blob my-key deleted from store my-store')

      expect(
        await fixture.callCli(['blobs:list', 'my-store', '--json'], {
          offline: false,
          parseJson: true,
        }),
      ).toEqual({ blobs: [], directories: [] })

      await expect(
        fixture.callCli(['blobs:get', 'my-store', 'my-key'], {
          offline: false,
        }),
      ).rejects.toThrowError('Error: Blob my-key does not exist in store my-store')
    })
  })
})
