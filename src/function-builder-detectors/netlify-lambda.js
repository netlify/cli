const execa = require('execa')
const minimist = require('minimist')

const { fileExistsAsync, readFileAsync } = require('../lib/fs')

const detectNetlifyLambda = async function ({ dependencies, devDependencies, scripts } = {}) {
  if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
    return false
  }

  const yarnExists = await fileExistsAsync('yarn.lock')
  const settings = {}

  for (const key in scripts) {
    const script = scripts[key]

    if (script.match(/netlify-lambda\s+build/)) {
      // E.g. ["netlify-lambda", "build", "functions/folder"]
      const match = minimist(script.split(' '))
      // We are not interested in 'netlify-lambda' and 'build' commands
      const functionDirectories = match._.slice(2)
      if (functionDirectories.length === 1) {
        ;[settings.src] = functionDirectories
        settings.npmScript = key
        break
      } else if (functionDirectories.length === 0) {
        console.warn("Command 'netlify-lambda build' was detected, but contained no functions folder")
      } else {
        console.warn("Command 'netlify-lambda build' was detected, but contained 2 or more function folders")
      }
    }
  }

  if (settings.npmScript) {
    settings.build = () => execa(yarnExists ? 'yarn' : 'npm', ['run', settings.npmScript])
    settings.builderName = 'netlify-lambda'
    return settings
  }

  return false
}

module.exports = async function handler() {
  const exists = await fileExistsAsync('package.json')
  if (!exists) {
    return false
  }

  const content = await readFileAsync('package.json')
  const packageSettings = JSON.parse(content, { encoding: 'utf8' })
  return detectNetlifyLambda(packageSettings)
}
module.exports.detectNetlifyLambda = detectNetlifyLambda
