import fs, { type ReadStream } from 'fs'

import { NetlifyAPI } from '@netlify/api'
import backoff from 'backoff'
import pMap from 'p-map'

import { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } from './constants.js'
import type { DeployEvent } from './status-cb.js'

export interface UploadFileObj {
  assetType: 'file' | 'function'
  body?: unknown
  filepath?: string
  hash?: string
  invocationMode?: string
  normalizedPath: string
  runtime?: string
  timeout?: number
}

const uploadFiles = async (
  api: NetlifyAPI,
  deployId: string,
  uploadList: UploadFileObj[],
  {
    concurrentUpload,
    maxRetry,
    statusCb,
  }: { concurrentUpload: number; maxRetry: number; statusCb: (status: DeployEvent) => void },
) => {
  if (!concurrentUpload) throw new Error('Missing required option concurrentUpload')
  statusCb({
    type: 'upload',
    msg: `Uploading ${uploadList.length} files`,
    phase: 'start',
  })

  const uploadFile = async (fileObj: UploadFileObj, index: number) => {
    const { assetType, body, filepath, invocationMode, normalizedPath, runtime, timeout } = fileObj

    // @ts-expect-error FIXME: filepath is required for fs.createReadStream
    const readStreamCtor = () => (body as ReadStream | undefined) ?? fs.createReadStream(filepath)

    statusCb({
      type: 'upload',
      msg: `(${index}/${uploadList.length}) Uploading ${normalizedPath}...`,
      phase: 'progress',
    })
    let response
    switch (assetType) {
      case 'file': {
        response = await retryUpload(
          () =>
            api.uploadDeployFile({
              body: readStreamCtor,
              deployId,
              path: encodeURI(normalizedPath),
            }),
          maxRetry,
        )
        break
      }
      case 'function': {
        response = await retryUpload((retryCount: number) => {
          const params = {
            body: readStreamCtor,
            deployId,
            invocationMode,
            timeout,
            name: encodeURI(normalizedPath),
            runtime,
            ...(retryCount > 0 && { xNfRetryCount: retryCount }),
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return api.uploadDeployFunction(params as any)
        }, maxRetry)
        break
      }
      default: {
        const error = new Error('File Object missing assetType property') as Error & { fileObj: UploadFileObj }
        error.fileObj = fileObj
        throw error
      }
    }

    return response
  }

  const results = await pMap(uploadList, uploadFile, { concurrency: concurrentUpload })
  statusCb({
    type: 'upload',
    msg: `Finished uploading ${uploadList.length} assets`,
    phase: 'stop',
  })
  return results
}

const retryUpload = <T>(uploadFn: (retryCount: number) => Promise<T>, maxRetry: number): Promise<T> =>
  new Promise((resolve, reject) => {
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
      } catch (error: unknown) {
        lastError = error

        const errorStatus = (error as { status?: number }).status
        const errorName = (error as Error).name

        // We don't need to retry for 400 or 422 errors
        if (errorStatus === 400 || errorStatus === 422) {
          reject(error)
          return
        }

        // observed errors: 408, 401 (4** swallowed), 502
        if ((errorStatus ?? 0) > 400 || errorName === 'FetchError') {
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
