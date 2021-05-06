const { sep } = require('path')

const pWaitFor = require('p-wait-for')

const { DEPLOY_POLL } = require('./constants')

// normalize windows paths to unix paths
const normalizePath = (relname) => {
  if (relname.includes('#') || relname.includes('?')) {
    throw new Error(`Invalid filename ${relname}. Deployed filenames cannot contain # or ? characters`)
  }
  return (
    relname
      .split(sep)
      // .map(segment => encodeURI(segment)) // TODO I'm fairly certain we shouldn't encodeURI here, thats only for the file upload step
      .join('/')
  )
}

// poll an async deployId until its done diffing
const waitForDiff = async (api, deployId, siteId, timeout) => {
  // capture ready deploy during poll
  let deploy

  const loadDeploy = async () => {
    const siteDeploy = await api.getSiteDeploy({ siteId, deployId })

    switch (siteDeploy.state) {
      // https://github.com/netlify/bitballoon/blob/master/app/models/deploy.rb#L21-L33
      case 'error': {
        const deployError = new Error(`Deploy ${deployId} had an error`)
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
    timeout,
    message: 'Timeout while waiting for deploy',
  })

  return deploy
}

// Poll a deployId until its ready
const waitForDeploy = async (api, deployId, siteId, timeout) => {
  // capture ready deploy during poll
  let deploy

  const loadDeploy = async () => {
    const siteDeploy = await api.getSiteDeploy({ siteId, deployId })
    switch (siteDeploy.state) {
      // https://github.com/netlify/bitballoon/blob/master/app/models/deploy.rb#L21-L33
      case 'error': {
        const deployError = new Error(`Deploy ${deployId} had an error`)
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
    timeout,
    message: 'Timeout while waiting for deploy',
  })

  return deploy
}

// Transform the fileShaMap and fnShaMap into a generic shaMap that file-uploader.js can use
const getUploadList = (required, shaMap) => {
  if (!required || !shaMap) return []
  // TODO: use `Array.flatMap()` instead once we remove support for Node <11.0.0
  return [].concat(...required.map((sha) => shaMap[sha]))
}

module.exports = {
  normalizePath,
  waitForDiff,
  waitForDeploy,
  getUploadList,
}
