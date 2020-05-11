const path = require('path')

module.exports.detectFunctionsBuilder = async function(projectDir) {
  const detectors = require('fs')
    .readdirSync(path.join(__dirname, '..', 'function-builder-detectors'))
    .filter(x => x.endsWith('.js')) // only accept .js detector files
    .map(det => require(path.join(__dirname, '..', `function-builder-detectors/${det}`)))

  for (const detector of detectors) {
    const settings = await detector(projectDir)
    if (settings) {
      return settings
    }
  }
}
