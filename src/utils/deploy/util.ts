import { sep } from 'path'

import type { NetlifyAPI } from '@netlify/api'
import pWaitFor from 'p-wait-for'

import { DEPLOY_POLL } from './constants.js'

export const pluralize = (amount: number, noun: string): string => `${amount} ${noun}${amount === 1 ? '' : 's'}`
export type Deploy = Awaited<ReturnType<NetlifyAPI['getSiteDeploy']>>

// FIXME(@netlify/api): every `deploy` field is optional, even those always set once a deploy is ready
export type ReadyDeploy = Deploy &
  Required<Pick<Deploy, 'id' | 'site_id' | 'name' | 'admin_url' | 'url' | 'ssl_url' | 'deploy_url' | 'deploy_ssl_url'>>

interface DeployStateError extends Error {
  deploy?: Deploy
}

// normalize windows paths to unix paths
export const normalizePath = (relname: string): string => {
  if (relname.includes('#') || relname.includes('?')) {
    throw new Error(`Invalid filename ${relname}. Deployed filenames cannot contain # or ? characters`)
  }
  return relname.split(sep).join('/')
}

// poll an async deployId until its done diffing
export const waitForDiff = async (
  api: Pick<NetlifyAPI, 'getSiteDeploy'>,
  deployId: string,
  siteId: string,
  timeout: number,
): Promise<Deploy> => {
  const loadDeploy = async () => {
    const siteDeploy = await api.getSiteDeploy({ siteId, deployId })

    switch (siteDeploy.state) {
      // https://github.com/netlify/bitballoon/blob/master/app/models/deploy.rb#L21-L33
      case 'error': {
        const deployError: DeployStateError = new Error(siteDeploy.error_message || `Deploy ${deployId} had an error`)
        deployError.deploy = siteDeploy
        throw deployError
      }
      case 'prepared':
      case 'uploading':
      case 'uploaded':
      case 'ready': {
        return pWaitFor.resolveWith(siteDeploy)
      }
      case 'preparing':
      default: {
        return false
      }
    }
  }

  const deploy = await pWaitFor(loadDeploy, {
    interval: DEPLOY_POLL,
    timeout: {
      milliseconds: timeout,
      message: 'Timeout while waiting for deploy',
    },
  })

  return deploy
}

// Poll a deployId until its ready
export const waitForDeploy = async (
  api: Pick<NetlifyAPI, 'getSiteDeploy'>,
  deployId: string,
  siteId: string,
  timeout: number,
): Promise<ReadyDeploy> => {
  const loadDeploy = async () => {
    const siteDeploy = await api.getSiteDeploy({ siteId, deployId })
    switch (siteDeploy.state) {
      // https://github.com/netlify/bitballoon/blob/master/app/models/deploy.rb#L21-L33
      case 'error': {
        const deployError: DeployStateError = new Error(siteDeploy.error_message || `Deploy ${deployId} had an error`)
        deployError.deploy = siteDeploy
        throw deployError
      }
      case 'ready': {
        return pWaitFor.resolveWith(siteDeploy)
      }
      case 'preparing':
      case 'prepared':
      case 'uploaded':
      case 'uploading':
      default: {
        return false
      }
    }
  }

  const deploy = await pWaitFor(loadDeploy, {
    interval: DEPLOY_POLL,
    timeout: {
      milliseconds: timeout,
      message: 'Timeout while waiting for deploy',
    },
  })

  return deploy as ReadyDeploy
}

// Transform the fileShaMap and fnShaMap into a generic shaMap that file-uploader.js can use
export const getUploadList = <T>(required: string[] | undefined, shaMap: Record<string, T[]> | undefined): T[] => {
  if (!required || !shaMap) return []
  return required.flatMap((sha) => shaMap[sha])
}
