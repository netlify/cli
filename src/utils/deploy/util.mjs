// @ts-check
import { basename, relative, sep } from 'path'

import pWaitFor from 'p-wait-for'

import { PUBLIC_URL_PATH } from '../../lib/edge-functions/consts.mjs'

import { DEPLOY_POLL } from './constants.mjs'

// normalize file objects
export const normalizePath = (fileObj, { configPath, deployFolder, edgeFunctionsFolder }) => {
  let normalizedPath = relative(deployFolder, fileObj.path)

  if (configPath === fileObj.path) {
    normalizedPath = basename(fileObj.path)
  }

  if (edgeFunctionsFolder && fileObj.path.startsWith(`${edgeFunctionsFolder}/`)) {
    const relpath = relative(edgeFunctionsFolder, fileObj.path)
    normalizedPath = `${PUBLIC_URL_PATH}/${relpath}`
  }

  if (normalizedPath.includes('#') || normalizedPath.includes('?')) {
    throw new Error(`Invalid filename ${normalizedPath}. Deployed filenames cannot contain # or ? characters`)
  }

  normalizedPath = normalizedPath.split(sep).join('/')
  return normalizedPath
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
