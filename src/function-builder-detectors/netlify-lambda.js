const execa = require('execa')

const { fileExistsAsync, readFileAsync } = require('../lib/fs')

const detectNetlifyLambda = async function ({ dependencies, devDependencies, scripts } = {}) {
  if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
    return false
  }

  const yarnExists = await fileExistsAsync('yarn.lock')
  const settings = {}

  for (const key in scripts) {
    const script = scripts[key]

    const match = script.match(/netlify-lambda build.* (\S+)\s*$/)
    if (match) {
      const [, src] = match
      settings.src = src
      settings.npmScript = key
      break
    }
  }

  if (settings.npmScript) {
    settings.build = () => execa(yarnExists ? 'yarn' : 'npm', ['run', settings.npmScript])
    settings.builderName = 'netlify-lambda'
    return settings
  }
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
