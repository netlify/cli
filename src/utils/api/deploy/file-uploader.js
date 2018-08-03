const pMap = require('p-map')
const fs = require('fs')
const debug = require('debug')('netlify:deploy:file-uploader')

module.exports = fileUploader
async function fileUploader(api, deployId, uploadList, { concurrentUpload }) {
  if (!concurrentUpload) throw new Error('Missing required option concurrentUpload')
  const uploadFile = async fileObj => {
    const { normalizedPath, assetType, runtime } = fileObj
    const readStream = fs.createReadStream(fileObj.filepath)
    debug(`uploading ${normalizedPath}`)

    let response
    switch (assetType) {
      case 'file': {
        response = await api.uploadDeployFile({
          body: readStream,
          deployId,
          path: normalizedPath
        })
        break
      }
      case 'function': {
        response = await api.uploadDeployFunction({
          body: readStream,
          deployId,
          name: normalizedPath,
          runtime
        })
        break
      }
      default: {
        const e = new Error('File Object missing assetType property')
        e.fileObj = fileObj
        throw e
      }
    }

    debug(`done uploading ${normalizedPath} (${assetType}`)
    return response
  }

  const results = await pMap(uploadList, uploadFile, { concurrency: concurrentUpload })

  return results
}
