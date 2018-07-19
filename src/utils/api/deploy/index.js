const pMap = require('p-map')
const fs = require('fs')
const fileHasher = require('./file-hasher')
const pWaitFor = require('p-wait-for')
const pTimeout = require('p-timeout')
const flatten = require('lodash.flatten')
const request = require('request')
const get = require('lodash.get')

module.exports = async (api, siteId, dir, opts) => {
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
  const response = await api.createSiteDeploy(siteId, { files }, {})
  const { id: deployId, required } = response
  const flattenedFileObjArray = flatten(required.map(sha => shaMap[sha]))
  console.log(required)

  const mapper = fileObj => {
    const { normalizedPath } = fileObj
    const readStream = fs.createReadStream(fileObj.filepath)
    const reqOpts = {
      url: `https://api.netlify.com/api/v1/deploys/${deployId}/files/${normalizedPath}`,
      headers: {
        'User-agent': 'Netlify CLI (oclif)',
        Authorization: 'Bearer ' + get(api, 'apiClient.authentications.netlifyAuth.accessToken'),
        'Content-Type': 'application/octet-stream',
        body: readStream
      }
    }
    return new Promise((resolve, reject) => {
      request.post(reqOpts, (err, httpResponse, body) => {
        if (err) return reject(err)
        resolve({ httpResponse, body })
      })
    })
  }

  const results = await pMap(flattenedFileObjArray, mapper, { concurrency: 4 })
  console.log(results)

  return deployId
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
    const d = await api.getDeploy(deployId)
    if (d.state === 'ready') {
      deploy = d
      return true
    } else {
      return false
    }
  }
}
