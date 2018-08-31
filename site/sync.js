const path = require('path')
const sane = require('sane')
const fs = require('fs-extra')
const config = require('./config')

function syncLocalContent() {
  const src = path.join(config.docs.srcPath)
  const destination = path.join(config.docs.outputPath)

  return fs.copy(src, destination).then(() => {
    console.log(`Docs synced to ${config.blog.outputPath} folder`)
  })
}
