// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'resolve'.
const { resolve } = require('path')

const minimist = require('minimist')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
const { execa } = require('../../../../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileExists... Remove this comment to see the full error message
const { fileExistsAsync } = require('../../../../fs.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'memoizedBu... Remove this comment to see the full error message
const { memoizedBuild } = require('../../../memoized-build.cjs')

const detectNetlifyLambda = async function ({
  packageJson
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe = {}) {
  const { dependencies, devDependencies, scripts } = packageJson || {}
  if (!((dependencies && dependencies['netlify-lambda']) || (devDependencies && devDependencies['netlify-lambda']))) {
    return false
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const matchingScripts = Object.entries(scripts).filter(([, script]) => (script as $TSFixMe).match(/netlify-lambda\s+build/));

  // eslint-disable-next-line fp/no-loops
  for (const [key, script] of matchingScripts) {
    // E.g. ["netlify-lambda", "build", "functions/folder"]
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const match = minimist((script as $TSFixMe).split(' '));
    // We are not interested in 'netlify-lambda' and 'build' commands
    const functionDirectories = match._.slice(2)
    if (functionDirectories.length === 1) {
      const srcFiles = [resolve(functionDirectories[0])]

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

  const content = await readFile('package.json', 'utf-8')
  const packageJson = JSON.parse(content)
  return detectNetlifyLambda({ packageJson })
}
module.exports.detectNetlifyLambda = detectNetlifyLambda
