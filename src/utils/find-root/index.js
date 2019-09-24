const path = require('path')
const findUp = require('find-up')
const os = require('os')

// Finds cwd's parent root directory
function findRoot(cwd = process.cwd(), opts) {
  opts = Object.assign(
    {
      rootIndicators: ['.netlify', 'netlify.toml', '.git']
    },
    opts
  )

  const rootIndicator = findUp.sync(opts.rootIndicators, { cwd: cwd })
  if (typeof rootIndicator !== 'string' || rootIndicator == null) return cwd

  const indicatorRoot = path.dirname(rootIndicator)
  // To avoid thinking our project root is our global config
  const root = indicatorRoot !== os.homedir() ? indicatorRoot : cwd

  return root
}

module.exports = findRoot
