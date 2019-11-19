const path = require('path')

module.exports.detectFunctionsBuilder = function() {
  const detectors = require('fs')
    .readdirSync(path.join(__dirname, '..', 'function-builder-detectors'))
    .filter(x => x.endsWith('.js')) // only accept .js detector files
    .map(det => require(path.join(__dirname, '..', `function-builder-detectors/${det}`)))

  for (const i in detectors) {
    const settings = detectors[i]()
    if (settings) {
      return settings
    }
  }
}
