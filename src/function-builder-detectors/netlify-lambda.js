const execa = require('execa')
const debounce = require('lodash/debounce')
const minimist = require('minimist')

const { fileExistsAsync, readFileAsync } = require('../lib/fs')

const DEBOUNCE_WAIT = 300

const detectNetlifyLambda = async function ({ dependencies, devDependencies, scripts } = {}) {
  if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
    return false
  }

  const matchingScripts = Object.entries(scripts).filter(([, script]) => script.match(/netlify-lambda\s+build/))

  for (const [key, script] of matchingScripts) {
    // E.g. ["netlify-lambda", "build", "functions/folder"]
    const match = minimist(script.split(' '))
    // We are not interested in 'netlify-lambda' and 'build' commands
    const functionDirectories = match._.slice(2)
    if (functionDirectories.length === 1) {
      // eslint-disable-next-line no-await-in-loop
      const yarnExists = await fileExistsAsync('yarn.lock')
      const debouncedBuild = debounce(execa, DEBOUNCE_WAIT, {
        leading: false,
        trailing: true,
      })

      return {
        src: functionDirectories[0],
        npmScript: key,
        build: async () => {
          await debouncedBuild(yarnExists ? 'yarn' : 'npm', ['run', key])
        },
        builderName: 'netlify-lambda',
      }
    }
    if (functionDirectories.length === 0) {
      console.warn(`Command 'netlify-lambda build' was detected in script '${key}', but contained no functions folder`)
    } else {
      console.warn(
        `Command 'netlify-lambda build' was detected in script '${key}', but contained 2 or more function folders`,
      )
    }
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
