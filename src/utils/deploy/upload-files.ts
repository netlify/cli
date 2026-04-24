import fs from 'fs'

import pMap from 'p-map'

import { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } from './constants.js'

// @ts-expect-error TS(7006) FIXME: Parameter 'api' implicitly has an 'any' type.
const uploadFiles = async (api, deployId, uploadList, { concurrentUpload, maxRetry, statusCb }) => {
  if (!concurrentUpload || !statusCb || !maxRetry) throw new Error('Missing required option concurrentUpload')
  statusCb({
    type: 'upload',
    msg: `Uploading ${uploadList.length} files`,
    phase: 'start',
  })

  // @ts-expect-error TS(7006) FIXME: Parameter 'fileObj' implicitly has an 'any' type.
  const uploadFile = async (fileObj, index) => {
    const { assetType, body, filepath, invocationMode, normalizedPath, runtime, timeout } = fileObj

    const readStreamCtor = () => body ?? fs.createReadStream(filepath)

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
          const params: Record<string, unknown> = {
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
        break
      }
      default: {
        const error = new Error('File Object missing assetType property')
        // @ts-expect-error TS(2339) FIXME: Property 'fileObj' does not exist on type 'Error'.
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

const retryUpload = (uploadFn: (retryCount: number) => Promise<unknown>, maxRetry: number) =>
  new Promise((resolve, reject) => {
    let lastError: unknown
    let retryCount = 0
    let previousDelay = 0
    let nextDelay = UPLOAD_INITIAL_DELAY

    const scheduleNextAttempt = () => {
      const baseDelay = Math.min(nextDelay, UPLOAD_MAX_DELAY)
      nextDelay = previousDelay + baseDelay
      previousDelay = baseDelay
      const jitteredDelay = Math.round(baseDelay * (1 + Math.random() * UPLOAD_RANDOM_FACTOR))
      setTimeout(() => {
        void tryUpload()
      }, jitteredDelay)
    }

    const tryUpload = async () => {
      try {
        const result = await uploadFn(retryCount)
        resolve(result)
        return
      } catch (error) {
        lastError = error
        const status = (error as { status?: number } | null)?.status
        const name = (error as { name?: string } | null)?.name

        if (status === 400 || status === 422) {
          reject(error)
          return
        }

        if ((typeof status === 'number' && status > 400) || name === 'FetchError') {
          retryCount += 1
          if (retryCount > maxRetry) {
            reject(lastError)
            return
          }
          scheduleNextAttempt()
          return
        }

        reject(error)
      }
    }

    void tryUpload()
  })

export default uploadFiles
