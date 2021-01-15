const path = require('path')
const process = require('process')

const pathExists = require('path-exists')
const semverLessThan = require('semver/functions/lt')

const { NETLIFYDEVWARN } = require('../utils/logo')

const warnOnOldNodeVersion = ({ log, chalk }) => {
  if (semverLessThan(process.version, '10.0.0')) {
    log(
      `${NETLIFYDEVWARN} ${chalk.bold('Netlify CLI')} will require ${chalk.magenta.bold(
        'Node.js 10',
      )} or greater soon. Please update your Node.js version.`,
    )
  }
}

const NETLIFY_DIR = 'netlify'
const DEFAULT_FUNCTIONS_SRC = path.join(NETLIFY_DIR, 'functions')

const formatDirectory = (chalk, directory) => chalk.redBright(directory)

const getCommunityLink = (chalk) =>
  chalk.magenta(
    'https://community.netlify.com/t/upcoming-change-netlify-functions-as-zero-config-default-folder-for-deploying-netlify-functions/28789',
  )

const logDefaultFunctionsSrcWarning = (log, chalk, netlifyDir, defaultFunctionsSrc) => {
  log(
    `${NETLIFYDEVWARN} Detected site repository path: ${formatDirectory(chalk, defaultFunctionsSrc)}
${NETLIFYDEVWARN} Starting in February 2021, this path will be used to detect and deploy Netlify functions.
${NETLIFYDEVWARN} To avoid potential build failures or irregularities, we recommend changing the name of the ${formatDirectory(
      chalk,
      netlifyDir,
    )} directory.
${NETLIFYDEVWARN} For more information, visit the Community update notification: ${getCommunityLink(chalk)}`,
  )
}

const logNetlifyDirWarning = (log, chalk, netlifyDir, defaultFunctionsSrc) => {
  log(
    `${NETLIFYDEVWARN} Detected site repository path: ${formatDirectory(chalk, netlifyDir)}
${NETLIFYDEVWARN} Netlify will begin using this path for detecting default deployment features, starting with ${formatDirectory(
      chalk,
      defaultFunctionsSrc,
    )} in February 2021.
${NETLIFYDEVWARN} To avoid potential build failures or irregularities in the future, we recommend changing the name of the ${formatDirectory(
      chalk,
      netlifyDir,
    )} directory.
${NETLIFYDEVWARN} For more information, visit the Community update notification: ${getCommunityLink(chalk)}`,
  )
}

const warnOnNetlifyDir = async ({ log, chalk, buildDir }) => {
  if (await pathExists(`${buildDir}/${DEFAULT_FUNCTIONS_SRC}`)) {
    logDefaultFunctionsSrcWarning(log, chalk, NETLIFY_DIR, DEFAULT_FUNCTIONS_SRC)
    return
  }
  if (await pathExists(`${buildDir}/${NETLIFY_DIR}`)) {
    logNetlifyDirWarning(log, chalk, NETLIFY_DIR, DEFAULT_FUNCTIONS_SRC)
  }
}

module.exports = { warnOnOldNodeVersion, warnOnNetlifyDir }
