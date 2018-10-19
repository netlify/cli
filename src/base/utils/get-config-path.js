const fs = require('fs')
const path = require('path')

module.exports = function getConfigPath(root) {
  // TODO support more formats
  const tomlPath = path.join(root, 'netlify.toml')

  if (fileExistsSync(tomlPath)) {
    return tomlPath
  }

  return undefined
}

function fileExistsSync(filePath) {
  try {
    const stats = fs.lstatSync(filePath)
    return stats.isFile()
  } catch (e) {
    return false
  }
}
