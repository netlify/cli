const pMap = require('p-map')
const fs = require('fs')
const fileHasher = require('./file-hasher')
const pWaitFor = require('p-wait-for')
const debug = require('debug')('netlify:deploy')
const flatten = require('lodash.flatten')

module.exports = async (api, siteId, dir, fnDir, opts) => {
  opts = Object.assign(
    {
      deployTimeout: 1.2e6, // 20 mins
      parallelHash: 100, // Queue up 100 file hashes at a time
      parallelUpload: 4 // Number of concurrent uploads
    },
    opts
  )

  // TODO Implement progress function
  const { files, shaMap } = await fileHasher(dir, opts)
  const { functions, fnShaMap } = await functionHasher(fnDir, opts)

  debug(`Hashed ${Object.keys(files).length} files`)
  debug(`Hashed ${Object.keys(functions).length} functions`)

  let deploy = await api.createSiteDeploy({ siteId, body: { files, functions } })

  const { id: deployId, required } = deploy
  const uploadList = getUploadList(required, Object.assign({}, shaMap, fnShaMap))

  debug(`Deploy requested ${uploadList.length} files`)
  await uploadFiles(api, deployId, uploadList, opts)
  debug(`Done uploading files.  Waiting on deploy...`)

  // Update deploy object
  deploy = await waitForDeploy(api, deployId, opts.deployTimeout)

  const deployManifest = {
    deployId,
    deploy,
    uploadList
  }

  return deployManifest
}

function getUploadList(required, shaMap) {
  return flatten(required.map(sha => shaMap[sha]))
}

async function uploadFiles(api, deployId, uploadList, opts) {
  const uploadFile = async fileObj => {
    const { normalizedPath } = fileObj
    const readStream = fs.createReadStream(fileObj.filepath)
    debug(`uploading ${normalizedPath}`)
    const response = await api.uploadDeployFile({
      body: readStream,
      deployId,
      path: normalizedPath
    })
    debug(`done uploading ${normalizedPath}`)
    return response
  }

  const results = await pMap(uploadList, uploadFile, { concurrency: opts.parallelUpload })

  return results
}

async function waitForDeploy(api, deployId, timeout) {
  let deploy

  await pWaitFor(loadDeploy, {
    interval: 1000,
    timeout,
    message: 'Timeout while waiting for deploy'
  })

  return deploy

  async function loadDeploy() {
    const d = await api.getDeploy({ deployId })
    if (d.state === 'ready') {
      deploy = d
      return true
    } else {
      return false
    }
  }
}
