const fs = require('fs')
const path = require('path')

const detectFunctionsBuilder = async function (parameters) {
  const buildersPath = path.join(__dirname, '..', 'lib', 'functions', 'runtimes', 'js', 'builders')
  const detectors = fs
    .readdirSync(buildersPath)
    // only accept .js detector files
    .filter((filename) => filename.endsWith('.js'))
    // Sorting by filename
    .sort()
    // eslint-disable-next-line node/global-require, import/no-dynamic-require
    .map((det) => require(path.join(buildersPath, det)))

  // eslint-disable-next-line fp/no-loops
  for (const detector of detectors) {
    // eslint-disable-next-line no-await-in-loop
    const settings = await detector(parameters)
    if (settings) {
      return settings
    }
  }
}

module.exports = { detectFunctionsBuilder }
