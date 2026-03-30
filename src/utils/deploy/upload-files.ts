import fs from 'fs'

import type { NetlifyAPI } from '@netlify/api'
import backoff from 'backoff'
import pMap from 'p-map'

import { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } from './constants.js'

export interface UploadFileObj {
  assetType: 'file' | 'function'
  body?: fs.ReadStream | (() => fs.ReadStream)
  filepath: string
  invocationMode?: string
  normalizedPath: string
  runtime?: string
  timeout?: number
}

interface StatusCbParams {
  type: 'upload'
  msg: string
  phase: 'start' | 'progress' | 'stop'
}

interface UploadOptions {
  concurrentUpload: number
  maxRetry: number
  statusCb: (params: StatusCbParams) => void
}

type UploadDeployFunctionParams = NonNullable<Parameters<NetlifyAPI['uploadDeployFunction']>[0]>

const uploadFiles = async (
  api: NetlifyAPI,
  deployId: string,
  uploadList: UploadFileObj[],
  { concurrentUpload, maxRetry, statusCb }: UploadOptions,
) => {
  statusCb({
    type: 'upload',
    msg: `Uploading ${uploadList.length} files`,
    phase: 'start',
  })

  const uploadFile = async (fileObj: UploadFileObj, index: number) => {
    const { assetType, body, filepath, invocationMode, normalizedPath, runtime, timeout } = fileObj

    const readStreamCtor = () => {
      if (typeof body === 'function') {
        return body()
      }
      return body ?? fs.createReadStream(filepath)
    }

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
          const params: UploadDeployFunctionParams & { xNfRetryCount?: number } = {
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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return api.uploadDeployFunction(params as any)
        }, maxRetry)
        break
      }
      default: {
        const error = new Error('File Object missing assetType property')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(error as any).fileObj = fileObj
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

const isErrorWithStatus = (error: unknown): error is { status: number; name?: string } =>
  typeof error === 'object' && error !== null && 'status' in error && typeof (error as Record<string, unknown>).status === 'number'

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
      } catch (error) {
        lastError = error

        // We don't need to retry for 400 or 422 errors
        if (isErrorWithStatus(error)) {
          if (error.status === 400 || error.status === 422) {
            reject(error)
            return
          }

          // observed errors: 408, 401 (4** swallowed), 502
          if (error.status > 400 || error.name === 'FetchError') {
            fibonacciBackoff.backoff()
            return
          }
        } else if (error instanceof Error && error.name === 'FetchError') {
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
