import { sep } from 'path'

import type { NetlifyAPI } from '@netlify/api'
import pWaitFor from 'p-wait-for'

import { DEPLOY_POLL } from './constants.js'

export type Deploy = Awaited<ReturnType<NetlifyAPI['getSiteDeploy']>>

// FIXME(@netlify/api): every `deploy` field is optional, even those always set once a deploy is ready
export type ReadyDeploy = Deploy &
  Required<Pick<Deploy, 'id' | 'site_id' | 'name' | 'admin_url' | 'url' | 'ssl_url' | 'deploy_url' | 'deploy_ssl_url'>>

export class DeployStateError extends Error {
  constructor(
    message: string,
    readonly deploy: Deploy,
  ) {
    super(message)
  }
}

// normalize windows paths to unix paths
export const normalizePath = (relname: string): string => {
  if (relname.includes('#') || relname.includes('?')) {
    throw new Error(`Invalid filename ${relname}. Deployed filenames cannot contain # or ? characters`)
  }
  return relname.split(sep).join('/')
}

// https://github.com/netlify/bitballoon/blob/master/app/models/deploy.rb#L21-L33
const DIFFED_STATES = new Set(['prepared', 'uploading', 'uploaded', 'ready'])
const READY_STATES = new Set(['ready'])

const pollDeployUntil = async (
  api: Pick<NetlifyAPI, 'getSiteDeploy'>,
  deployId: string,
  siteId: string,
  timeout: number,
  targetStates: Set<string>,
): Promise<Deploy> =>
  await pWaitFor(
    async () => {
      const siteDeploy = await api.getSiteDeploy({ siteId, deployId })

      if (siteDeploy.state === 'error') {
        throw new DeployStateError(siteDeploy.error_message || `Deploy ${deployId} had an error`, siteDeploy)
      }

      return siteDeploy.state !== undefined && targetStates.has(siteDeploy.state) && pWaitFor.resolveWith(siteDeploy)
    },
    {
      interval: DEPLOY_POLL,
      timeout: {
        milliseconds: timeout,
        message: 'Timeout while waiting for deploy',
      },
    },
  )

// poll an async deployId until its done diffing
export const waitForDiff = async (
  api: Pick<NetlifyAPI, 'getSiteDeploy'>,
  deployId: string,
  siteId: string,
  timeout: number,
): Promise<Deploy> => await pollDeployUntil(api, deployId, siteId, timeout, DIFFED_STATES)

// Poll a deployId until its ready
export const waitForDeploy = async (
  api: Pick<NetlifyAPI, 'getSiteDeploy'>,
  deployId: string,
  siteId: string,
  timeout: number,
): Promise<ReadyDeploy> => (await pollDeployUntil(api, deployId, siteId, timeout, READY_STATES)) as ReadyDeploy

// Transform the fileShaMap and fnShaMap into a generic shaMap that file-uploader.js can use
export const getUploadList = <T>(required: string[] | undefined, shaMap: Record<string, T[]> | undefined): T[] => {
  if (!required || !shaMap) return []
  return required.flatMap((sha) => shaMap[sha])
}
