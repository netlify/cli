const path = require('path')
const findUp = require('find-up')
const os = require('os')

// Finds cwd's parent root directory
function findProjectRoot(cwd) {
  const rootIndicators = [
    '.netlify',
    'netlify.toml',
    '.git'
  ]

  const rootIndicator = findUp.sync(rootIndicators, { cwd: cwd })
  
  const indicatorRoot = path.dirname(rootIndicator)
  const root = rootIndicator && (indicatorRoot !== os.homedir()) ? indicatorRoot : cwd
  return root
}
const root = findProjectRoot(process.cwd())

module.exports = root
