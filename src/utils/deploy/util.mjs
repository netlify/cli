// @ts-check
import { sep } from 'path'

import pWaitFor from 'p-wait-for'

import { DEPLOY_POLL } from './constants.mjs'

// normalize windows paths to unix paths
export const normalizePath = (relname) => {
  if (relname.includes('#') || relname.includes('?')) {
    throw new Error(`Invalid filename ${relname}. Deployed filenames cannot contain # or ? characters`)
  }
  return relname.split(sep).join('/')
}

// poll an async deployId until its done diffing
export const waitForDiff = async (api, deployId, siteId, timeout) => {
  // capture ready deploy during poll
  let deploy

  const loadDeploy = async () => {
    const siteDeploy = await api.getSiteDeploy({ siteId, deployId })

    switch (siteDeploy.state) {
      // https://github.com/netlify/bitballoon/blob/master/app/models/deploy.rb#L21-L33
      case 'error': {
        const deployError = new Error(siteDeploy.error_message || `Deploy ${deployId} had an error`)
        deployError.deploy = siteDeploy
        throw deployError
      }
      case 'prepared':
      case 'uploading':
      case 'uploaded':
      case 'ready': {
        deploy = siteDeploy
        return true
      }
      case 'preparing':
      default: {
        return false
      }
    }
  }

  await pWaitFor(loadDeploy, {
    interval: DEPLOY_POLL,
    timeout: {
      milliseconds: timeout,
      message: 'Timeout while waiting for deploy',
    },
  })

  return deploy
}

// Poll a deployId until its ready
export const waitForDeploy = async (api, deployId, siteId, timeout) => {
  // capture ready deploy during poll
  let deploy

  const loadDeploy = async () => {
    const siteDeploy = await api.getSiteDeploy({ siteId, deployId })
    switch (siteDeploy.state) {
      // https://github.com/netlify/bitballoon/blob/master/app/models/deploy.rb#L21-L33
      case 'error': {
        const deployError = new Error(siteDeploy.error_message || `Deploy ${deployId} had an error`)
        deployError.deploy = siteDeploy
        throw deployError
      }
      case 'ready': {
        deploy = siteDeploy
        return true
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

  await pWaitFor(loadDeploy, {
    interval: DEPLOY_POLL,
    timeout: {
      milliseconds: timeout,
      message: 'Timeout while waiting for deploy',
    },
  })

  return deploy
}

// Transform the fileShaMap and fnShaMap into a generic shaMap that file-uploader.js can use
export const getUploadList = (required, shaMap) => {
  if (!required || !shaMap) return []
  return required.flatMap((sha) => shaMap[sha])
}
