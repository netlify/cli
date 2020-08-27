const { existsSync, readFileSync } = require('fs')
const execa = require('execa')
const { getEnvSettings } = require('../utils/env')

module.exports = async function(projectDir) {
  if (!existsSync('package.json')) {
    return false
  }

  const packageSettings = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }))
  const { dependencies, devDependencies, scripts } = packageSettings
  if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
    return false
  }

  const yarnExists = existsSync('yarn.lock')
  const settings = {}

  for (const key in scripts) {
    const script = scripts[key]
    const match = script.match(/netlify-lambda build (\S+)/)
    if (match) {
      settings.src = match[1]
      settings.npmScript = key
      break
    }
  }

  let env = {}
  const envSettings = await getEnvSettings(projectDir)
  if (envSettings.file) {
    env = envSettings.vars
  }

  if (settings.npmScript) {
    settings.build = () => execa(yarnExists ? 'yarn' : 'npm', ['run', settings.npmScript], { env })
    settings.builderName = 'netlify-lambda'
    return settings
  }
}
