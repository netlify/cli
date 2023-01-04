// @ts-check
import boxen from 'boxen'
import dotProp from 'dot-prop'
import inquirer from 'inquirer'
import isEmpty from 'lodash/isEmpty.js'

import { BRAND, chalk, exit, log, logH1, logInfo, logWarn } from '../../utils/command-helpers.mjs'
import getRepoData from '../../utils/get-repo-data.mjs'
import { ensureNetlifyIgnore } from '../../utils/gitignore.mjs'
import { configureRepo } from '../../utils/init/config.mjs'
import { track } from '../../utils/telemetry/index.mjs'
import { link } from '../link/index.mjs'
import { sitesCreate } from '../sites/index.mjs'

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
 * @param {import('../base-command.mjs').default} config.command
 */
const createNewSiteAndExit = async ({ command, state }) => {
  const siteInfo = await sitesCreate({}, command)

  log(
    boxen(
      `Your site "${
        siteInfo.name
      }" was created!\n\nTo deploy:\n\nBuild your site using the build command, and then run ${chalk
        .bgHex(BRAND.COLORS.BLUE)
        .whiteBright.bold('netlify deploy')}`,
      {
        title: chalk.hex(BRAND.COLORS.CYAN).bold(`👉 Next steps`),
        padding: 1,
        margin: 0,
        align: 'left',
        borderStyle: 'doubleSingle',
        borderColor: BRAND.COLORS.CYAN,
      },
    ),
  )
  log()

  persistState({ state, siteInfo })

  exit()
}

const logGitSetupInstructionsAndExit = () => {
  log()

  log(
    boxen(
      chalk.bold(
        `1. Initialize a new git repository

  ${chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold(`git init`)}

2. Add your files

  ${chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold(`git add .`)}

3. Commit your files

  ${chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold(`git commit -m 'Initial commit'`)}

4. Create a new repo in GitHub 

  ${chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold('https://github.com/new')}

5. Link the remote repo with this local directory

  ${chalk
    .bgHex(BRAND.COLORS.BLUE)
    .whiteBright.bold('git remote add origin git@github.com:YourGithubName/your-repo-slug.git')}

6. Push up your files

  ${chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold('git push -u origin main')}

7. Initialize your new Netlify Site

  ${chalk.bgHex(BRAND.COLORS.BLUE).whiteBright.bold('netlify init')}`,
      ),
      {
        title: chalk.hex(BRAND.COLORS.CYAN).bold('👉 Next steps'),
        padding: 1,
        margin: 0,
        align: 'left',
        borderStyle: 'doubleSingle',
        borderColor: BRAND.COLORS.CYAN,
      },
    ),
  )

  exit()
}

/**
 * Handles the case where no git remote was found.
 * @param {object} config
 * @param {import('../base-command.mjs').default} config.command
 * @param {object} config.error
 * @param {object} config.state
 */
const handleNoGitRemoteAndExit = async ({ command, error, state }) => {
  logWarn({ message: 'No git remote was found, would you like to set one up?' })
  log(
    boxen(
      chalk.bold(
        `We recommend you initialize a site that has a remote repository in GitHub. \n\nThis will allow for Netlify Continuous Deployment to build branch & PR previews automatically.\n\nFor more details, check out the docs 👉 ntl.fyi/configure-builds`,
      ),
      {
        title: chalk.hex(BRAND.COLORS.CYAN).bold('For best results'),
        padding: 1,
        margin: 0,
        align: 'left',
        borderStyle: 'doubleSingle',
        borderColor: BRAND.COLORS.CYAN,
      },
    ),
  )
  log()

  if (error === "Couldn't find origin url") {
    logWarn({ message: `Unable to find a remote origin URL. Please add a git remote!` })
    logInfo({ message: 'git remote add origin https://github.com/YourUserName/RepoName.git' })
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
 * @param {import('../base-command.mjs').default} command
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
 * @param {import('../base-command.mjs').default} command
 */
export const init = async (options, command) => {
  command.setAnalyticsPayload({ manual: options.manual, force: options.force })
  logH1({ message: 'netlify init' })

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

  log()

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
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createInitCommand = (program) =>
  program
    .command('init')
    .description(
      'Configure continuous deployment for a new or existing site. To create a new site without continuous deployment, use `netlify sites:create`',
    )
    .option('-m, --manual', 'Manually configure a git remote for CI')
    .option('--force', 'Reinitialize CI hooks if the linked site is already configured to use CI')
    .option('--gitRemoteName <name>', 'Name of Git remote to use. e.g. "origin"')
    .action(init)
