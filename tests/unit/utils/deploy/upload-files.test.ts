import { v4 as generateUUID } from 'uuid'
import { afterAll, expect, test, vi } from 'vitest'

import type { NetlifyAPI } from '@netlify/api'
import uploadFiles, { type UploadFileObj } from '../../../../src/utils/deploy/upload-files.js'

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
  } as unknown as NetlifyAPI
  const deployId = generateUUID()
  const files: UploadFileObj[] = [
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

test('Does not retry on 400 response from function upload requests', async () => {
  const uploadDeployFunction = vi.fn()
  const mockError = new Error('Uh-oh')

  Object.assign(mockError, { status: 400 })

  uploadDeployFunction.mockRejectedValue(mockError)

  const mockApi = {
    uploadDeployFunction,
  } as unknown as NetlifyAPI
  const deployId = generateUUID()
  const files: UploadFileObj[] = [
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
