import fs from 'fs'

import type { NetlifyAPI } from '@netlify/api'
import backoff from 'backoff'
import pMap from 'p-map'

import { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } from './constants.js'
import type { StatusCallback } from './status-cb.js'

export type UploadApi = Pick<NetlifyAPI, 'uploadDeployFile' | 'uploadDeployFunction' | 'uploadDeployEdgeFunction'>

// `@netlify/api` only models path and query parameters, so header parameters such as
// `X-Nf-Retry-Count` have to be added on top of the generated parameter types.
type WithRetryCount<T> = T & { xNfRetryCount?: number }

type UploadDeployFunctionParams = WithRetryCount<Parameters<UploadApi['uploadDeployFunction']>[0]>
type UploadDeployEdgeFunctionParams = WithRetryCount<Parameters<UploadApi['uploadDeployEdgeFunction']>[0]>

interface UploadFileBase {
  filepath: string
  normalizedPath: string
  body?: fs.ReadStream
}

export interface StaticUploadFile extends UploadFileBase {
  assetType: 'file'
}

export interface FunctionUploadFile extends UploadFileBase {
  assetType: 'function'
  runtime?: string
  invocationMode?: string
  timeout?: number
}

export interface EdgeFunctionUploadFile extends UploadFileBase {
  assetType: 'edge-function'
  hash: string
}

export type UploadFile = StaticUploadFile | FunctionUploadFile | EdgeFunctionUploadFile

class MissingAssetTypeError extends Error {
  constructor(readonly fileObj: unknown) {
    super('File Object missing assetType property')
  }
}

interface UploadFilesOptions {
  concurrentUpload: number
  maxRetry: number
  statusCb: StatusCallback
}

const uploadFiles = async (
  api: UploadApi,
  deployId: string,
  uploadList: UploadFile[],
  { concurrentUpload, maxRetry, statusCb }: UploadFilesOptions,
) => {
  if (!concurrentUpload || !maxRetry) throw new Error('Missing required option concurrentUpload')
  statusCb({
    type: 'upload',
    msg: `Uploading ${uploadList.length} files`,
    phase: 'start',
  })

  const uploadFile = async (fileObj: UploadFile, index: number) => {
    const { body, filepath, normalizedPath } = fileObj

    const readStreamCtor = () => body ?? fs.createReadStream(filepath)

    statusCb({
      type: 'upload',
      msg: `(${index}/${uploadList.length}) Uploading ${normalizedPath}...`,
      phase: 'progress',
    })

    switch (fileObj.assetType) {
      case 'file': {
        return await retryUpload(
          () =>
            api.uploadDeployFile({
              body: readStreamCtor,
              deployId,
              path: encodeURI(normalizedPath),
            }),
          maxRetry,
        )
      }
      case 'function': {
        const { invocationMode, runtime, timeout } = fileObj

        return await retryUpload((retryCount) => {
          const params: UploadDeployFunctionParams = {
            body: readStreamCtor,
            deployId,
            invocationMode,
            timeout,
            name: encodeURI(normalizedPath),
            runtime,
          }

          if (retryCount > 0) {
            params.xNfRetryCount = retryCount
          }

          return api.uploadDeployFunction(params)
        }, maxRetry)
      }
      case 'edge-function': {
        return await retryUpload((retryCount) => {
          const params: UploadDeployEdgeFunctionParams = {
            body: readStreamCtor,
            deployId,
            codeSha: normalizedPath,
          }

          if (retryCount > 0) {
            params.xNfRetryCount = retryCount
          }

          return api.uploadDeployEdgeFunction(params)
        }, maxRetry)
      }
      default: {
        throw new MissingAssetTypeError(fileObj)
      }
    }
  }

  const results = await pMap(uploadList, uploadFile, { concurrency: concurrentUpload })
  statusCb({
    type: 'upload',
    msg: `Finished uploading ${uploadList.length} assets`,
    phase: 'stop',
  })
  return results
}

const getErrorStatus = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined

const retryUpload = <T>(uploadFn: (retryCount: number) => Promise<T>, maxRetry: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let lastError: unknown

    const fibonacciBackoff = backoff.fibonacci({
      randomisationFactor: UPLOAD_RANDOM_FACTOR,
      initialDelay: UPLOAD_INITIAL_DELAY,
      maxDelay: UPLOAD_MAX_DELAY,
    })

    const tryUpload = async (retryIndex = -1) => {
      try {
        const results = await uploadFn(retryIndex + 1)

        resolve(results)
        return
      } catch (error) {
        lastError = error

        const status = getErrorStatus(error)

        // We don't need to retry for 400 or 422 errors
        if (status === 400 || status === 422) {
          reject(error)
          return
        }

        // observed errors: 408, 401 (4** swallowed), 502
        if ((status !== undefined && status > 400) || (error instanceof Error && error.name === 'FetchError')) {
          fibonacciBackoff.backoff()
          return
        }
        reject(error)
        return
      }
    }

    fibonacciBackoff.failAfter(maxRetry)

    fibonacciBackoff.on('backoff', () => {
      // Do something when backoff starts, e.g. show to the
      // user the delay before next reconnection attempt.
    })

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    fibonacciBackoff.on('ready', tryUpload)

    fibonacciBackoff.on('fail', () => {
      reject(lastError)
    })

    tryUpload()
  })

export default uploadFiles
