const debug = require('debug')('netlify:deploy')
const fileUploader = require('./file-uploader')
const fileHasher = require('./file-hasher')
const fnHasher = require('./fn-hasher')

const { waitForDeploy, getUploadList } = require('./util')

module.exports = async (api, siteId, dir, fnDir, opts) => {
  // TODO Implement progress cb
  opts = Object.assign(
    {
      deployTimeout: 1.2e6, // 20 mins
      concurrentHash: 100, // concurrent file hash calls
      concurrentUpload: 4 // Number of concurrent uploads
    },
    opts
  )

  const [{ files, filesShaMap }, { functions, fnShaMap }] = await Promise.all([
    fileHasher(dir, opts),
    fnHasher(fnDir, opts)
  ])

  debug(`Hashed ${Object.keys(files).length} files`)
  debug(`Hashed ${Object.keys(functions).length} functions`)

  let deploy = await api.createSiteDeploy({ siteId, body: { files, functions } })
  const { id: deployId, required } = deploy

  const uploadList = getUploadList(required, filesShaMap, fnShaMap)

  debug(`Deploy requested ${uploadList.length} files`)
  await fileUploader(api, deployId, uploadList, {
    concurrentUpload: opts.concurrentUpload
  })
  debug(`Done uploading files.`)

  debug(`Polling deploy...`)
  deploy = await waitForDeploy(api, deployId, opts.deployTimeout)
  debug(`Deploy complete`)

  const deployManifest = {
    deployId,
    deploy,
    uploadList
  }

  return deployManifest
}
