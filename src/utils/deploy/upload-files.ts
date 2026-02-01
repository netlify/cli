import fs from 'fs'

import backoff from 'backoff'
import pMap from 'p-map'
import type { NetlifyAPI } from '@netlify/api'

import { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } from './constants.js'

export interface FileObject {
  assetType: 'file' | 'function'
  body?: any
  filepath?: string
  invocationMode?: string
  normalizedPath: string
  runtime?: string
  timeout?: number
}

interface UploadStatus {
  type: 'upload'
  msg: string
  phase: 'start' | 'progress' | 'stop'
}

interface UploadOptions {
  concurrentUpload: number
  maxRetry: number
  statusCb: (status: UploadStatus) => void
}

const uploadFiles = async (
  api: Pick<NetlifyAPI, 'uploadDeployFile' | 'uploadDeployFunction'>,
  deployId: string,
  uploadList: FileObject[],
  { concurrentUpload, maxRetry, statusCb }: UploadOptions,
) => {
  statusCb({
    type: 'upload',
    msg: `Uploading ${uploadList.length} files`,
    phase: 'start',
  })

  const uploadFile = async (fileObj: FileObject, index: number) => {
    const { assetType, body, filepath, invocationMode, normalizedPath, runtime, timeout } = fileObj

    const readStreamCtor = () => body ?? fs.createReadStream(filepath!)

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
            (api as unknown as NetlifyAPI).uploadDeployFile({
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
          } as any

          if (retryCount > 0) {
            params.xNfRetryCount = retryCount
          }

          return (api as unknown as NetlifyAPI).uploadDeployFunction(params)
        }, maxRetry)
        break
      }
      default: {
        const error = new Error('File Object missing assetType property')
        Object.assign(error, { fileObj })
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
      } catch (error) {
        lastError = error

        // We don't need to retry for 400 or 422 errors
        if (error && typeof error === 'object' && 'status' in error) {
          const { status } = error as { status: number }
          if (status === 400 || status === 422) {
            reject(error)
            return
          }

          // observed errors: 408, 401 (4** swallowed), 502
          if (status > 400) {
            fibonacciBackoff.backoff()
            return
          }
        }

        if (error && typeof error === 'object' && 'name' in error && error.name === 'FetchError') {
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
