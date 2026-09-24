import crypto from 'crypto'
import { afterAll, expect, test, vi } from 'vitest'

import uploadFiles, { type UploadApi, type UploadFile } from '../../../../src/utils/deploy/upload-files.js'

vi.mock('../../../../src/utils/deploy/constants.js', async () => {
  const actual = await vi.importActual('../../../../src/utils/deploy/constants.js')

  // Reduce the delay, so these tests do not wait for 10 seconds
  return { ...actual, UPLOAD_INITIAL_DELAY: 100, UPLOAD_MAX_DELAY: 200 }
})

afterAll(() => {
  vi.restoreAllMocks()
})

test('Adds a retry count to function upload requests', async () => {
  const uploadDeployFunction = vi.fn()
  const mockError = new Error('Uh-oh')

  Object.assign(mockError, { status: 500 })

  uploadDeployFunction.mockRejectedValueOnce(mockError)
  uploadDeployFunction.mockRejectedValueOnce(mockError)
  uploadDeployFunction.mockResolvedValueOnce(undefined)

  const mockApi = {
    uploadDeployFunction,
  } as unknown as UploadApi
  const deployId = crypto.randomUUID()
  const files: UploadFile[] = [
    {
      assetType: 'function',
      filepath: '/some/path/func1.zip',
      normalizedPath: 'func1.zip',
      runtime: 'js',
    },
  ]
  const options = {
    concurrentUpload: 1,
    maxRetry: 3,
    statusCb: vi.fn(),
  }

  await uploadFiles(mockApi, deployId, files, options)

  expect(uploadDeployFunction).toHaveBeenCalledTimes(3)
  expect(uploadDeployFunction).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ xNfRetryCount: 1 }))
  expect(uploadDeployFunction).toHaveBeenNthCalledWith(2, expect.objectContaining({ xNfRetryCount: 1 }))
  expect(uploadDeployFunction).toHaveBeenNthCalledWith(3, expect.objectContaining({ xNfRetryCount: 2 }))
})

test('Adds a retry count to edge function upload requests', async () => {
  const uploadDeployEdgeFunction = vi.fn()
  const mockError = new Error('Uh-oh')

  Object.assign(mockError, { status: 500 })

  uploadDeployEdgeFunction.mockRejectedValueOnce(mockError)
  uploadDeployEdgeFunction.mockResolvedValueOnce(undefined)

  const mockApi = {
    uploadDeployEdgeFunction,
  } as unknown as UploadApi
  const deployId = crypto.randomUUID()
  const files: UploadFile[] = [
    {
      assetType: 'edge-function',
      filepath: '/some/path/abc123.tar.gz',
      normalizedPath: 'abc123',
      hash: 'abc123',
    },
  ]
  const options = {
    concurrentUpload: 1,
    maxRetry: 3,
    statusCb: vi.fn(),
  }

  await uploadFiles(mockApi, deployId, files, options)

  expect(uploadDeployEdgeFunction).toHaveBeenCalledTimes(2)
  expect(uploadDeployEdgeFunction).toHaveBeenNthCalledWith(1, expect.objectContaining({ codeSha: 'abc123' }))
  expect(uploadDeployEdgeFunction).toHaveBeenNthCalledWith(1, expect.not.objectContaining({ xNfRetryCount: 1 }))
  expect(uploadDeployEdgeFunction).toHaveBeenNthCalledWith(2, expect.objectContaining({ xNfRetryCount: 1 }))
})

test('Does not retry on 400 response from function upload requests', async () => {
  const uploadDeployFunction = vi.fn()
  const mockError = new Error('Uh-oh')

  Object.assign(mockError, { status: 400 })

  uploadDeployFunction.mockRejectedValue(mockError)

  const mockApi = {
    uploadDeployFunction,
  } as unknown as UploadApi
  const deployId = crypto.randomUUID()
  const files: UploadFile[] = [
    {
      assetType: 'function',
      filepath: '/some/path/func1.zip',
      normalizedPath: 'func1.zip',
      runtime: 'js',
    },
  ]
  const options = {
    concurrentUpload: 1,
    maxRetry: 3,
    statusCb: vi.fn(),
  }

  try {
    await uploadFiles(mockApi, deployId, files, options)
  } catch {}

  expect(uploadDeployFunction).toHaveBeenCalledTimes(1)
})

test('Uploads a Netlify Server addressed by its digest, and retries it', async () => {
  const uploadDeployServer = vi.fn()
  const mockError = new Error('Uh-oh')

  Object.assign(mockError, { status: 500 })

  uploadDeployServer.mockRejectedValueOnce(mockError)
  uploadDeployServer.mockResolvedValueOnce(undefined)

  const mockApi = {
    uploadDeployServer,
  } as unknown as UploadApi
  const deployId = crypto.randomUUID()
  const codeSha = 'abc123'
  const files: UploadFile[] = [
    {
      assetType: 'server',
      filepath: 'server.tgz',
      normalizedPath: 'server',
      hash: codeSha,
    } as unknown as UploadFile,
  ]

  await uploadFiles(mockApi, deployId, files, { concurrentUpload: 1, maxRetry: 3, statusCb: () => {} })

  expect(uploadDeployServer).toHaveBeenCalledTimes(2)
  expect(uploadDeployServer.mock.calls[0][0]).not.toHaveProperty('name')
  expect(uploadDeployServer.mock.calls[0][0]).toMatchObject({ deployId, codeSha })
  expect(uploadDeployServer.mock.calls[1][0]).toMatchObject({ deployId, codeSha, xNfRetryCount: 1 })
})
