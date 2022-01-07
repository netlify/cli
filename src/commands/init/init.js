// @ts-check
const dotProp = require('dot-prop')
const inquirer = require('inquirer')
const isEmpty = require('lodash/isEmpty')

const { chalk, ensureNetlifyIgnore, exit, getRepoData, log, track } = require('../../utils')
const { configureRepo } = require('../../utils/init/config')
const { link } = require('../link')
const { sitesCreate } = require('../sites')

const persistState = ({ siteInfo, state }) => {
  // Save to .netlify/state.json file
  state.set('siteId', siteInfo.id)
}

const getRepoUrl = ({ siteInfo }) => dotProp.get(siteInfo, 'build_settings.repo_url')

const logExistingAndExit = ({ siteInfo }) => {
  log()
  log(`This site has been initialized`)
  log()
  log(`Site Name:  ${chalk.cyan(siteInfo.name)}`)
  log(`Site Url:   ${chalk.cyan(siteInfo.ssl_url || siteInfo.url)}`)
  log(`Site Repo:  ${chalk.cyan(getRepoUrl({ siteInfo }))}`)
  log(`Site Id:    ${chalk.cyan(siteInfo.id)}`)
  log(`Admin URL:  ${chalk.cyan(siteInfo.admin_url)}`)
  log()
  log(`To disconnect this directory and create a new site (or link to another siteId)`)
  log(`1. Run ${chalk.cyanBright.bold('netlify unlink')}`)
  log(`2. Then run ${chalk.cyanBright.bold('netlify init')} again`)
  exit()
}

/**
 * Creates and new site and exits the process
 * @param {object} config
 * @param {*} config.state
 * @param {import('../base-command').BaseCommand} config.command
 */
const createNewSiteAndExit = async ({ command, state }) => {
  const siteInfo = await sitesCreate({}, command)

  log(`"${siteInfo.name}" site was created`)
  log()
  log(`To deploy to this site. Run your site build and then ${chalk.cyanBright.bold('netlify deploy')}`)

  persistState({ state, siteInfo })

  exit()
}

const logGitSetupInstructionsAndExit = () => {
  log()
  log(`${chalk.bold('To initialize a new git repo follow the steps below.')}

1. Initialize a new repo:

   ${chalk.cyanBright.bold('git init')}

2. Commit your files

   ${chalk.cyanBright.bold('git add .')}

3. Commit your files

   ${chalk.cyanBright.bold("git commit -m 'initial commit'")}

4. Create a new repo in GitHub ${chalk.cyanBright.bold('https://github.com/new')}

5. Link the remote repo with this local directory

   ${chalk.cyanBright.bold('git remote add origin git@github.com:YourGithubName/your-repo-slug.git')}

6. Push up your files

   ${chalk.cyanBright.bold('git push -u origin main')}

7. Initialize your Netlify Site

   ${chalk.cyanBright.bold('netlify init')}
`)
  exit()
}

/**
 * Handles the case where no git remote was found.
 * @param {object} config
 * @param {import('../base-command').BaseCommand} config.command
 * @param {object} config.error
 * @param {object} config.state
 */
const handleNoGitRemoteAndExit = async ({ command, error, state }) => {
  log()
  log(`${chalk.yellow('No git remote was found, would you like to set one up?')}`)
  log(`
It is recommended that you initialize a site that has a remote repository in GitHub.

This will allow for Netlify Continuous deployment to build branch & PR previews.

For more details on Netlify CI checkout the docs: http://bit.ly/2N0Jhy5
`)
  if (error === "Couldn't find origin url") {
    log(`Unable to find a remote origin URL. Please add a git remote.

git remote add origin https://github.com/YourUserName/RepoName.git
`)
  }

  const NEW_SITE_NO_GIT = 'Yes, create and deploy site manually'
  const NO_ABORT = 'No, I will connect this directory with GitHub first'

  const { noGitRemoteChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'noGitRemoteChoice',
      message: 'Do you want to create a Netlify site without a git repository?',
      choices: [NEW_SITE_NO_GIT, NO_ABORT],
    },
  ])

  if (noGitRemoteChoice === NEW_SITE_NO_GIT) {
    await createNewSiteAndExit({ state, command })
  } else if (noGitRemoteChoice === NO_ABORT) {
    logGitSetupInstructionsAndExit()
  }
}

/**
 * Creates a new site or links an existing one to the repository
 * @param {import('../base-command').BaseCommand} command
 */
const createOrLinkSiteToRepo = async (command) => {
  const NEW_SITE = '+  Create & configure a new site'
  const EXISTING_SITE = '⇄  Connect this directory to an existing Netlify site'

  const initializeOpts = [EXISTING_SITE, NEW_SITE]

  const { initChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'initChoice',
      message: 'What would you like to do?',
      choices: initializeOpts,
    },
  ])

  // create site or search for one
  if (initChoice === NEW_SITE) {
    await track('sites_initStarted', {
      type: 'new site',
    })
    // run site:create command
    return await sitesCreate({}, command)
  }
  if (initChoice === EXISTING_SITE) {
    // run link command
    return await link({}, command)
  }
}

const logExistingRepoSetupAndExit = ({ repoUrl, siteName }) => {
  log()
  log(chalk.underline.bold(`Success`))
  log(`This site "${siteName}" is configured to automatically deploy via ${repoUrl}`)
  // TODO add support for changing GitHub repo in site:config command
  exit()
}

/**
 * The init command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const init = async (options, command) => {
  command.setAnalyticsPayload({ manual: options.manual, force: options.force })

  const { repositoryRoot, state } = command.netlify
  let { siteInfo } = command.netlify

  // Check logged in status
  await command.authenticate()

  // Add .netlify to .gitignore file
  await ensureNetlifyIgnore(repositoryRoot)

  const repoUrl = getRepoUrl({ siteInfo })
  if (repoUrl && !options.force) {
    logExistingAndExit({ siteInfo })
  }

  // Look for local repo
  const repoData = await getRepoData({ remoteName: options.gitRemoteName })
  if (repoData.error) {
    await handleNoGitRemoteAndExit({ command, error: repoData.error, state })
  }

  if (isEmpty(siteInfo)) {
    siteInfo = await createOrLinkSiteToRepo(command)
  }

  // Check for existing CI setup
  const remoteBuildRepo = getRepoUrl({ siteInfo })
  if (remoteBuildRepo && !options.force) {
    logExistingRepoSetupAndExit({ siteName: siteInfo.name, repoUrl: remoteBuildRepo })
  }

  persistState({ state, siteInfo })

  await configureRepo({ command, siteId: siteInfo.id, repoData, manual: options.manual })

  return siteInfo
}

/**
 * Creates the `netlify init` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createInitCommand = (program) =>
  program
    .command('init')
    .description(
      'Configure continuous deployment for a new or existing site. To create a new site without continuous deployment, use `netlify sites:create`',
    )
    .option('-m, --manual', 'Manually configure a git remote for CI')
    .option('--force', 'Reinitialize CI hooks if the linked site is already configured to use CI')
    .option('--gitRemoteName <name>', 'Name of Git remote to use. e.g. "origin"')
    .action(init)

module.exports = { createInitCommand, init }
