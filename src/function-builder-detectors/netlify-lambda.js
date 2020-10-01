const { existsSync, readFileSync } = require('fs')

const execa = require('execa')

/**
 * Function builder detector for netlify-lambda.
 *
 * @param {object} [packageSettings] npm package.json format, if not provided, defaults to reading package.json from the file system.
 */
module.exports = function handler(packageSettings) {
  if (!packageSettings) {
    if (!existsSync('package.json')) {
      return false
    }

    packageSettings = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }))
  }

  const { dependencies, devDependencies, scripts } = packageSettings
  if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
    return false
  }

  const yarnExists = existsSync('yarn.lock')
  const settings = {}

  for (const key in scripts) {
    const script = scripts[key]

    const match = script.match(/netlify-lambda build.* (\S+)\s*$/)
    console.log(match)
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
