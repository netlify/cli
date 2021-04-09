const fs = require('fs')
const path = require('path')

const detectFunctionsBuilder = async function (parameters) {
  const detectors = fs
    .readdirSync(path.join(__dirname, '..', 'function-builder-detectors'))
    // only accept .js detector files
    .filter((filename) => filename.endsWith('.js'))
    // Sorting by filename
    .sort()
    // eslint-disable-next-line node/global-require, import/no-dynamic-require
    .map((det) => require(path.join(__dirname, '..', `function-builder-detectors/${det}`)))

  for (const detector of detectors) {
    // eslint-disable-next-line no-await-in-loop
    const settings = await detector(parameters)
    if (settings) {
      return settings
    }
  }
}

module.exports = { detectFunctionsBuilder }
