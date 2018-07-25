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
  console.log(`Hashed ${Object.keys(files).length} files`)
  let deploy = await api.createSiteDeploy(siteId, { files }, {})

  const { id: deployId, required } = deploy
  const uploadList = getUploadList(required, shaMap)
  console.log(`Deploy requested ${uploadList.length} files`)
  await uploadFiles(api, deployId, uploadList)
  console.log(`Done uploading files.  Waiting on deploy...`)
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

async function uploadFiles(api, deployId, uploadList) {
  const uploadFile = fileObj => {
    const { normalizedPath } = fileObj
    const readStream = fs.createReadStream(fileObj.filepath)
    const reqOpts = {
      url: `https://api.netlify.com/api/v1/deploys/${deployId}/files/${normalizedPath}`,
      headers: {
        'User-agent': 'Netlify CLI (oclif)',
        Authorization: 'Bearer ' + get(api, 'apiClient.authentications.netlifyAuth.accessToken'),
        'Content-Type': 'application/octet-stream'
      },
      body: readStream
    }

    console.log(`uploading ${normalizedPath}`)
    return new Promise((resolve, reject) => {
      request.put(reqOpts, (err, httpResponse, body) => {
        if (err) return reject(err)
        if (httpResponse.statusCode >= 400) {
          const apiError = new Error('There was an error with one of the file uploads')
          apiError.response = httpResponse
          return reject(apiError)
        }
        try {
          body = JSON.parse(body)
        } catch (_) {
          // Ignore if body can't parse
        }
        console.log(`done uploading ${normalizedPath}`)
        resolve({ httpResponse, body })
      })
    })
  }

  const results = await pMap(uploadList, uploadFile, { concurrency: 4 })

  return results
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
