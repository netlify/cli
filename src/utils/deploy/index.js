const pMap = require('p-map')
const fs = require('fs')
const fileHasher = require('./file-hasher')
const pWaitFor = require('p-wait-for')
const pTimeout = require('p-timeout')

exports.deploy = deploy
async function deploy(api, siteId, dir, opts) {
  opts = Object.assign(
    {
      deployTimeout: 1.2e6 // 20 mins
    },
    opts
  )

  const { files, shaMap } = await fileHasher(dir, opts)

  const deployId = await uploadFiles(api, siteId, files, shaMap)
  const deployObj = await waitForDeploy(api, deployId, opts.deployTimeout)

  return deployObj
}

async function uploadFiles(api, siteId, files, shaMap) {
  const { deploy_id: deployId, required } = await api.createSiteDeploy(siteId, { files })

  await pMap(required, uploadJob, { concurrency: 4 })

  return deployId

  function uploadJob(sha) {
    return () => {
      const fileObj = shaMap[sha]
      const { normalizedPath } = fileObj
      const readStream = fs.createReadStream(fileObj.path)
      return api.uploadDeployFile(deployId, normalizedPath, readStream)
    }
  }
}

async function waitForDeploy(api, deployId, timeout) {
  let deploy

  await pTimeout(
    pWaitFor(loadDeploy, 1000), // poll every 1 second
    timeout,
    'Timeout while waiting for deploy'
  )

  return deploy

  async function loadDeploy() {
    const d = await this.api.getDeploy(deployId)
    if (d.state === 'ready') {
      deploy = d
      return true
    } else {
      return false
    }
  }
}
