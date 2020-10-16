/**
 * responsible for any js based projects
 * and can therefore build in assumptions that only js projects have
 *
 */
const { existsSync, readFileSync } = require('fs')

let pkgJSON = null
let yarnExists = false
let warnedAboutEmptyScript = false
const { NETLIFYDEVWARN } = require('../../utils/logo')

/** hold package.json in a singleton so we dont do expensive parsing repeatedly */
const getPkgJSON = function () {
  if (pkgJSON) {
    return pkgJSON
  }
  if (!existsSync('package.json')) throw new Error('dont call this method unless you already checked for pkg json')
  pkgJSON = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }))
  return pkgJSON
}
const getYarnOrNPMCommand = function () {
  if (!yarnExists) {
    yarnExists = existsSync('yarn.lock') ? 'yes' : 'no'
  }
  return yarnExists === 'yes' ? 'yarn' : 'npm'
}

/**
 * real utiltiies are down here
 *
 */

const hasRequiredDeps = function (requiredDepArray) {
  const { dependencies, devDependencies } = getPkgJSON()
  for (const depName of requiredDepArray) {
    const hasItInDeps = dependencies && dependencies[depName]
    const hasItInDevDeps = devDependencies && devDependencies[depName]
    if (!hasItInDeps && !hasItInDevDeps) {
      return false
    }
  }
  return true
}
const hasRequiredFiles = function (filenameArr) {
  for (const filename of filenameArr) {
    if (!existsSync(filename)) {
      return false
    }
  }
  return true
}

// preferredScriptsArr is in decreasing order of preference
const scanScripts = function ({ preferredScriptsArr, preferredCommand }) {
  const { scripts } = getPkgJSON()

  if (!scripts && !warnedAboutEmptyScript) {
    console.log(`${NETLIFYDEVWARN} You have a package.json without any npm scripts.`)
    console.log(
      `${NETLIFYDEVWARN} Netlify Dev's detector system works best with a script, or you can specify a command to run in the netlify.toml [dev]  block `,
    )
    // dont spam message with every detector
    warnedAboutEmptyScript = true
    // not going to match any scripts anyway
    return []
  }
  //
  //
  // NOTE: we return an array of arrays (args)
  // because we may want to supply extra args in some setups
  //
  // e.g. ['eleventy', '--serve', '--watch']
  //
  // array will in future be sorted by likelihood of what we want
  //
  //
  // this is very simplistic logic, we can offer far more intelligent logic later
  // eg make a dependency tree of npm scripts and offer the parentest node first
  return Object.entries(scripts)
    .filter(
      ([scriptName, scriptCommand]) =>
        (preferredScriptsArr.includes(scriptName) || scriptCommand.includes(preferredCommand)) &&
        // prevent netlify dev calling netlify dev
        !scriptCommand.includes('netlify dev'),
    )
    .map(([scriptName]) => [scriptName])
}

module.exports = {
  hasRequiredDeps,
  hasRequiredFiles,
  getYarnOrNPMCommand,
  scanScripts,
}
