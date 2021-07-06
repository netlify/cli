const { resolve } = require('path')

const execa = require('execa')
const minimist = require('minimist')

const { fileExistsAsync, readFileAsync } = require('../../../../fs')
const { memoizedBuild } = require('../../../memoized-build')

const detectNetlifyLambda = async function ({ packageJson } = {}) {
  const { dependencies, devDependencies, scripts } = packageJson || {}
  if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
    return false
  }

  const matchingScripts = Object.entries(scripts).filter(([, script]) => script.match(/netlify-lambda\s+build/))

  // eslint-disable-next-line fp/no-loops
  for (const [key, script] of matchingScripts) {
    // E.g. ["netlify-lambda", "build", "functions/folder"]
    const match = minimist(script.split(' '))
    // We are not interested in 'netlify-lambda' and 'build' commands
    const functionDirectories = match._.slice(2)
    if (functionDirectories.length === 1) {
      const srcFiles = [resolve(functionDirectories[0])]

      // eslint-disable-next-line no-await-in-loop
      const yarnExists = await fileExistsAsync('yarn.lock')
      const buildCommand = () => execa(yarnExists ? 'yarn' : 'npm', ['run', key])

      return {
        build: async ({ cache = {} } = {}) => {
          await memoizedBuild({ cache, cacheKey: `netlify-lambda-${key}`, command: buildCommand })

          return {
            srcFiles,
          }
        },
        builderName: 'netlify-lambda',

        // Currently used for tests only.
        npmScript: key,
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
  const packageJson = JSON.parse(content, { encoding: 'utf8' })
  return detectNetlifyLambda({ packageJson })
}
module.exports.detectNetlifyLambda = detectNetlifyLambda
