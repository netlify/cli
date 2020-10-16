const path = require('path')

const detectFunctionsBuilder = async function (projectDir) {
  const detectors = require('fs')
    .readdirSync(path.join(__dirname, '..', 'function-builder-detectors'))
    // only accept .js detector files
    .filter((filename) => filename.endsWith('.js'))
    .map((det) => require(path.join(__dirname, '..', `function-builder-detectors/${det}`)))

  for (const detector of detectors) {
    // eslint-disable-next-line no-await-in-loop
    const settings = await detector(projectDir)
    if (settings) {
      return settings
    }
  }
}

module.exports = { detectFunctionsBuilder }
