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

    if (script.includes("netlify-lambda build")) {
      const match = minimist(script.split(" "))
      // _ should be ['netlify-lambda', 'build', 'functions_folder']
      if (match._.length === 3) {
        settings.src = match._[2]
        settings.npmScript = key
        break
      } else {
        console.warn("'netlify-lambda build' command found but no functions folder was found")
      }
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
