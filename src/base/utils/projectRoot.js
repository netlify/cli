const path = require('path')
const findUp = require('find-up')

// Finds cwd's parent root directory
function findProjectRoot(cwd) {
  const rootIndicators = [
    '.netlify',
    'netlify.toml',
    '.git'
  ]

  const rootIndicator = findUp.sync(rootIndicators, { cwd: cwd })
  const root = (rootIndicator) ? path.dirname(rootIndicator) : cwd
  return root
}

const root = findProjectRoot(process.cwd())

module.exports = root
