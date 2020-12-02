const chalk = require('chalk')

const configGithub = require('./config-github')
const configManual = require('./config-manual')

const configureGitHub = async ({ context, siteId, repoData }) => {
  try {
    await configGithub({ context, siteId, repoName: repoData.name, repoOwner: repoData.owner })
  } catch (error) {
    context.warn(`GitHub error: ${error.status}`)
    if (error.status === 404) {
      context.error(
        `Does the repository ${repoData.repo} exist and do you have the correct permissions to set up deploy keys?`,
      )
    } else {
      throw error
    }
  }
}

const logSuccess = ({ log, repoData }) => {
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

const configureRepo = async ({ context, siteId, repoData, manual }) => {
  if (manual) {
    await configManual({ context, siteId, repoData })
  } else {
    switch (repoData.provider) {
      case 'github': {
        await configureGitHub({ context, siteId, repoData })
        break
      }
      default: {
        context.log(`No configurator found for the provided git remote. Configuring manually...`)
        await configManual({ context, siteId, repoData })
      }
    }
  }

  logSuccess({ log: context.log, repoData })
}
module.exports = { configureRepo }
