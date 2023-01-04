// @ts-check
import boxen from 'boxen'

import { BRAND, chalk, log } from '../command-helpers.mjs'

import { configGithub } from './config-github.mjs'
import configManual from './config-manual.mjs'

const logSuccess = (repoData) => {
  log()
  log(
    boxen(
      chalk.bold(
        `Netlify CI/CD has been configured!\n\nThis site is now configured to automatically deploy from ${
          repoData.provider
        } branches and pull requests.\n\nNext steps:\n\n${chalk
          .bgHex(BRAND.COLORS.BLUE)
          .whiteBright.bold(`git push`)}: push to your git repository to trigger new site builds\n\n${chalk
          .bgHex(BRAND.COLORS.BLUE)
          .whiteBright.bold(`netlify open`)}: open the Netlify admin URL of your site to view your dashboard`,
      ),
      {
        title: chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold(' 🎉 Success! 🎉 '),
        padding: 1,
        margin: 0,
        align: 'left',
        borderStyle: 'doubleSingle',
        borderColor: BRAND.COLORS.BLUE,
      },
    ),
  )
  log()
}

/**
 * @param {object} config
 * @param {import('../../commands/base-command.mjs').default} config.command
 * @param {boolean} config.manual
 * @param {*} config.repoData
 * @param {string} config.siteId
 */
export const configureRepo = async ({ command, manual, repoData, siteId }) => {
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
