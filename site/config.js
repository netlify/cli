const path = require('path')

const rootDir = path.join(__dirname, '..')

module.exports = {
  rootDir: rootDir,
  docs: {
    srcPath: path.join(rootDir, 'docs'),
    outputPath: path.join(rootDir, 'site/src'),
  },
}
