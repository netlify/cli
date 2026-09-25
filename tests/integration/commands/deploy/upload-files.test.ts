import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { NetlifyAPI } from '@netlify/api'
import type { Response } from 'express'
import { expect, onTestFinished, test, vi } from 'vitest'

import uploadFiles, { type UploadFile } from '../../../../src/utils/deploy/upload-files.js'
import type { Route } from '../../utils/mock-api-vitest.js'
import { startDeployMockApi } from './deploy-api-routes.js'

vi.mock('../../../../src/utils/deploy/constants.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/deploy/constants.js')>()),
  UPLOAD_INITIAL_DELAY: 10,
  UPLOAD_MAX_DELAY: 20,
  UPLOAD_RANDOM_FACTOR: 0,
}))

const content = Buffer.from(Array.from({ length: 256 * 1024 }, (_, index) => index % 256))
const deployId = 'deploy_id'
const assetCases: { name: string; file: UploadFile; route: string; retryHeader: boolean }[] = [
  {
    name: 'static file',
    file: { assetType: 'file', filepath: '', normalizedPath: 'assets/data.bin' },
    route: 'files/assets/data.bin',
    retryHeader: false,
  },
  {
    name: 'function',
    file: { assetType: 'function', filepath: '', normalizedPath: 'hello', runtime: 'js' },
    route: 'functions/hello',
    retryHeader: true,
  },
  {
    name: 'edge function',
    file: { assetType: 'edge-function', filepath: '', normalizedPath: 'edge-hash', hash: 'edge-hash' },
    route: 'edge_functions/edge-hash',
    retryHeader: true,
  },
]

const createFixture = async (routes: Route[]) => {
  const directory = await mkdtemp(join(tmpdir(), 'netlify-upload-test-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  const filepath = join(directory, 'asset.bin')
  await writeFile(filepath, content)

  const mockApi = await startDeployMockApi({ routes })
  onTestFinished(async () => {
    mockApi.server.closeAllConnections()
    await mockApi.close()
  })
  const api = new NetlifyAPI('fake-token', { scheme: 'http', host: new URL(mockApi.apiUrl).host })
  const statusCb = vi.fn()
  const options = { concurrentUpload: 2, maxRetry: 2, statusCb }
  return { filepath, mockApi, api, options, statusCb }
}

test.each(assetCases)(
  'reopens the complete $name body after an upload failure',
  async ({ file, route, retryHeader }) => {
    let attempts = 0
    const { api, filepath, mockApi, options, statusCb } = await createFixture([
      {
        path: `deploys/${deployId}/${route}`,
        method: 'PUT',
        response: (_req, res) => {
          attempts += 1
          res.status(attempts === 1 ? 502 : 200).json({ attempt: attempts })
        },
      },
    ])

    const results = await uploadFiles(api, deployId, [{ ...file, filepath }], options)

    expect(results).toEqual([{ attempt: 2 }])
    expect(mockApi.requests).toHaveLength(2)
    for (const request of mockApi.requests) {
      expect(request.method).toBe('PUT')
      expect(request.body).toEqual(content)
    }
    expect(mockApi.requests.map(({ headers }) => headers['x-nf-retry-count'])).toEqual([
      undefined,
      retryHeader ? '1' : undefined,
    ])
    expect(statusCb).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'upload', phase: 'stop' }))
  },
)

test.each([400, 422])(
  'rejects a permanent HTTP %i failure without retrying or reporting completion',
  async (status) => {
    const failure = { message: 'Invalid function upload' }
    const { api, filepath, mockApi, options, statusCb } = await createFixture([
      { path: `deploys/${deployId}/functions/hello`, method: 'PUT', status, response: failure },
    ])

    await expect(
      uploadFiles(
        api,
        deployId,
        [{ assetType: 'function', filepath, normalizedPath: 'hello', runtime: 'js' }],
        options,
      ),
    ).rejects.toMatchObject({ status, json: failure })

    expect(mockApi.requests).toHaveLength(1)
    expect(statusCb).not.toHaveBeenCalledWith(expect.objectContaining({ phase: 'stop' }))
  },
)

test('rejects with the last HTTP error when the upload retry budget is exhausted', async () => {
  let attempts = 0
  const { api, filepath, mockApi, options, statusCb } = await createFixture([
    {
      path: `deploys/${deployId}/functions/hello`,
      method: 'PUT',
      response: (_req, res) => {
        attempts += 1
        res.status(502).json({ message: `Upload failure ${attempts.toString()}` })
      },
    },
  ])

  await expect(
    uploadFiles(api, deployId, [{ assetType: 'function', filepath, normalizedPath: 'hello', runtime: 'js' }], options),
  ).rejects.toMatchObject({ status: 502, json: { message: 'Upload failure 3' } })

  expect(mockApi.requests).toHaveLength(3)
  expect(mockApi.requests.map(({ headers }) => headers['x-nf-retry-count'])).toEqual([undefined, '1', '2'])
  expect(statusCb).not.toHaveBeenCalledWith(expect.objectContaining({ phase: 'stop' }))
})

test('limits concurrent HTTP uploads and returns results in input order', async () => {
  const pending = new Map<string, Response>()
  let active = 0
  let peak = 0
  const { api, filepath, mockApi, options, statusCb } = await createFixture([
    {
      path: `deploys/${deployId}/files/:name`,
      method: 'PUT',
      response: (req, res) => {
        active += 1
        peak = Math.max(peak, active)
        pending.set(req.params.name as string, res)
      },
    },
  ])
  const files: UploadFile[] = ['first', 'second', 'third'].map((normalizedPath) => ({
    assetType: 'file',
    filepath,
    normalizedPath,
  }))
  const controller = new AbortController()
  const completed = new Set<string>()
  const uploadDeployFile = api.uploadDeployFile.bind(api)
  api.uploadDeployFile = async (params, opts) => {
    const result = await uploadDeployFile(params, { ...opts, signal: controller.signal })
    completed.add(params.path)
    return result
  }
  const uploads = uploadFiles(api, deployId, files, options)
  // Observe rejections immediately if a broken uploader fails before the assertions below.
  void uploads.catch(() => {})
  const complete = (name: string) => {
    const response = pending.get(name)
    if (!response) {
      throw new Error(`No pending upload for ${name}`)
    }
    active -= 1
    response.json({ name })
  }

  try {
    await vi.waitFor(() => {
      expect(pending.size).toBe(2)
    })
    expect([...pending.keys()].sort()).toEqual(['first', 'second'])
    complete('second')
    await vi.waitFor(() => {
      expect(pending.size).toBe(3)
    })
    complete('third')
    await vi.waitFor(() => {
      expect(completed.has('third')).toBe(true)
    })
    expect(statusCb).not.toHaveBeenCalledWith(expect.objectContaining({ phase: 'stop' }))
    complete('first')

    await expect(uploads).resolves.toEqual([{ name: 'first' }, { name: 'second' }, { name: 'third' }])
    expect(peak).toBe(options.concurrentUpload)
    expect(mockApi.requests).toHaveLength(3)
    expect(statusCb).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'stop' }))
  } finally {
    controller.abort()
    await uploads.catch(() => {})
  }
})
