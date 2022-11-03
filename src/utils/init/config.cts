// @ts-check
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'chalk'.
const { chalk, log } = require('../command-helpers.cjs')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'configGith... Remove this comment to see the full error message
const { configGithub } = require('./config-github.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const configManual = require('./config-manual.cjs')

const logSuccess = (repoData: $TSFixMe) => {
  log()
  log(chalk.greenBright.bold.underline(`Success! Netlify CI/CD Configured!`))
  log()
  log(`This site is now configured to automatically deploy from ${repoData.provider} branches & pull requests`)
  log()
  log(`Next steps:

  ${chalk.cyanBright.bold('git push')}       Push to your git repository to trigger new site builds
  ${chalk.cyanBright.bold('netlify open')}   Open the Netlify admin URL of your site
  `)
}

/**
 * @param {object} config
 * @param {import('../../commands/base-command').BaseCommand} config.command
 * @param {boolean} config.manual
 * @param {*} config.repoData
 * @param {string} config.siteId
 */
const configureRepo = async ({
  command,
  manual,
  repoData,
  siteId
}: $TSFixMe) => {
  if (manual) {
    await configManual({ command, siteId, repoData })
  } else if (repoData.provider === 'github') {
    await configGithub({ command, siteId, repoName: repoData.name, repoOwner: repoData.owner })
  } else {
    log(`No configurator found for the provided git remote. Configuring manually...`)
    await configManual({ command, siteId, repoData })
  }

  logSuccess(repoData)
}
// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { configureRepo }
