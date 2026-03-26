// TODO: These Drop API helpers should be migrated to @netlify/api once the Drop
// endpoints are added to the OpenAPI spec. Until then, we use raw fetch calls.

import fs from 'fs'

import pWaitFor from 'p-wait-for'

import { DEPLOY_POLL, DEFAULT_DEPLOY_TIMEOUT, DEFAULT_CONCURRENT_UPLOAD, DEFAULT_MAX_RETRY } from './constants.js'
import type { StatusCallback } from './status-cb.js'

const APP_NETLIFY_REFERRER = 'https://app.netlify.com'

interface DropDeployInfo {
  id: string
  deploy_id: string
  subdomain: string
  url: string
  state: string
  required: string[]
}

interface DropApiOptions {
  apiBase: string
  userAgent: string
}

const makeHeaders = (userAgent: string, extra: Record<string, string> = {}): Record<string, string> => ({
  'User-Agent': userAgent,
  Referer: APP_NETLIFY_REFERRER,
  ...extra,
})

// TODO: Migrate to @netlify/api when Drop endpoints are in the OpenAPI spec.
export const getDropToken = async ({ apiBase, userAgent }: DropApiOptions): Promise<string> => {
  const response = await fetch(`${apiBase}/drop/token`, {
    method: 'POST',
    headers: makeHeaders(userAgent, { 'Content-Type': 'application/json' }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get drop token: ${String(response.status)} ${response.statusText}`)
  }

  const data = (await response.json()) as { token: string }
  return data.token
}

// TODO: Migrate to @netlify/api when Drop endpoints are in the OpenAPI spec.
export const createDropDeploy = async (
  { apiBase, userAgent }: DropApiOptions,
  files: Record<string, string>,
  token: string,
  createdVia?: string,
): Promise<DropDeployInfo> => {
  const body: Record<string, unknown> = { files, token }
  if (createdVia) {
    body.created_via = createdVia
  }

  const response = await fetch(`${apiBase}/drop`, {
    method: 'POST',
    headers: makeHeaders(userAgent, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create drop deploy: ${String(response.status)} ${errorText}`)
  }

  return (await response.json()) as DropDeployInfo
}

interface UploadError extends Error {
  status?: number
}

// TODO: Migrate to @netlify/api when Drop endpoints are in the OpenAPI spec.
export const uploadDropFile = async (
  { apiBase, userAgent }: DropApiOptions,
  deployId: string,
  filePath: string,
  body: fs.ReadStream | Buffer,
  token: string,
): Promise<void> => {
  // Node.js fetch needs `duplex: 'half'` for streaming bodies which isn't in standard RequestInit
  /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
  const normalizedFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`
  const response: Response = await fetch(`${apiBase}/deploys/${deployId}/files${encodeURI(normalizedFilePath)}`, {
    method: 'PUT',
    headers: makeHeaders(userAgent, {
      'Content-Type': 'application/octet-stream',
      Authorization: `Bearer ${token}`,
    }),
    body: body as any,
    duplex: 'half',
  } as any)
  /* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */

  if (!response.ok) {
    const error: UploadError = new Error(
      `Failed to upload file ${filePath}: ${String(response.status)} ${response.statusText}`,
    )
    error.status = response.status
    throw error
  }
}

// TODO: Migrate to @netlify/api when Drop endpoints are in the OpenAPI spec.
export const waitForDropDeploy = async (
  { apiBase, userAgent }: DropApiOptions,
  siteId: string,
  deployId: string,
  timeout: number = DEFAULT_DEPLOY_TIMEOUT,
): Promise<Record<string, unknown>> => {
  let deploy: Record<string, unknown> | undefined

  const checkDeploy = async (): Promise<boolean> => {
    const response = await fetch(`${apiBase}/sites/${siteId}/deploys/${deployId}`, {
      headers: makeHeaders(userAgent),
    })

    if (!response.ok) {
      return false
    }

    const data = (await response.json()) as Record<string, unknown>
    if (data.state === 'ready') {
      deploy = data
      return true
    }
    if (data.state === 'error') {
      throw new Error((data.error_message as string) || `Deploy ${deployId} had an error`)
    }
    return false
  }

  await pWaitFor(checkDeploy, {
    interval: DEPLOY_POLL,
    timeout: {
      milliseconds: timeout,
      message: 'Timeout while waiting for deploy',
    },
  })

  // deploy is guaranteed to be set when pWaitFor resolves
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return deploy!
}

// TODO: Migrate to @netlify/api when Drop endpoints are in the OpenAPI spec.
export const claimDropSite = async (
  { apiBase, userAgent }: DropApiOptions,
  siteId: string,
  dropToken: string,
  authToken: string,
): Promise<void> => {
  const response = await fetch(`${apiBase}/drop/claim`, {
    method: 'POST',
    headers: makeHeaders(userAgent, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    }),
    body: JSON.stringify({ site: siteId, token: dropToken }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to claim site: ${String(response.status)} ${errorText}`)
  }
}

export interface UploadListItem {
  normalizedPath: string
  filepath: string
  hash: string
}

export const uploadDropFiles = async (
  apiOptions: DropApiOptions,
  deployId: string,
  uploadList: UploadListItem[],
  token: string,
  {
    concurrentUpload = DEFAULT_CONCURRENT_UPLOAD,
    maxRetry = DEFAULT_MAX_RETRY,
    statusCb = (() => {}) as StatusCallback,
  }: {
    concurrentUpload?: number
    maxRetry?: number
    statusCb?: StatusCallback
  } = {},
): Promise<void> => {
  const { default: pMap } = await import('p-map')

  statusCb({
    type: 'upload',
    msg: `Uploading ${String(uploadList.length)} files`,
    phase: 'start',
  })

  const uploadFile = async (fileObj: UploadListItem, index: number) => {
    statusCb({
      type: 'upload',
      msg: `(${String(index + 1)}/${String(uploadList.length)}) Uploading ${fileObj.normalizedPath}...`,
      phase: 'progress',
    })

    let lastError: UploadError | undefined
    for (let attempt = 0; attempt <= maxRetry; attempt++) {
      try {
        const body = fs.createReadStream(fileObj.filepath)
        await uploadDropFile(apiOptions, deployId, fileObj.normalizedPath, body, token)
        return
      } catch (error) {
        lastError = error as UploadError
        if (lastError.status === 400 || lastError.status === 422) {
          throw error
        }
        if (attempt < maxRetry) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }
    if (lastError) {
      throw lastError
    }
  }

  await pMap(uploadList, uploadFile, { concurrency: concurrentUpload })

  statusCb({
    type: 'upload',
    msg: `Finished uploading ${String(uploadList.length)} assets`,
    phase: 'stop',
  })
}
