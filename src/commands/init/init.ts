import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import isEmpty from 'lodash/isEmpty.js'

import { chalk, exit, log } from '../../utils/command-helpers.js'
import getRepoData from '../../utils/get-repo-data.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { configureRepo } from '../../utils/init/config.js'
import { track } from '../../utils/telemetry/index.js'
import type BaseCommand from '../base-command.js'
import { link } from '../link/link.js'
import { sitesCreate } from '../sites/sites-create.js'
import type { CLIState, SiteInfo } from '../../utils/types.js'

const persistState = ({ siteInfo, state }: { siteInfo: SiteInfo; state: CLIState }): void => {
  // Save to .netlify/state.json file
  state.set('siteId', siteInfo.id)
}

const getRepoUrl = (siteInfo: SiteInfo): string => siteInfo.build_settings?.repo_url ?? ''

const logExistingAndExit = ({ siteInfo }: { siteInfo: SiteInfo }): never => {
  log()
  log(`This site has been initialized`)
  log()
  log(`Site Name:  ${chalk.cyan(siteInfo.name)}`)
  log(`Site Url:   ${chalk.cyan(siteInfo.ssl_url || siteInfo.url)}`)
  log(`Site Repo:  ${chalk.cyan(getRepoUrl(siteInfo))}`)
  log(`Site Id:    ${chalk.cyan(siteInfo.id)}`)
  log(`Admin URL:  ${chalk.cyan(siteInfo.admin_url)}`)
  log()
  log(`To disconnect this directory and create a new site (or link to another siteId)`)
  log(`1. Run ${chalk.cyanBright.bold('netlify unlink')}`)
  log(`2. Then run ${chalk.cyanBright.bold('netlify init')} again`)
  return exit()
}

/**
 * Creates and new site and exits the process
 */
const createNewSiteAndExit = async ({ command, state }: { command: BaseCommand; state: CLIState }): Promise<never> => {
  const siteInfo = await sitesCreate({}, command)

  log(`"${siteInfo.name}" site was created`)
  log()
  log(`To deploy to this site. Run your site build and then ${chalk.cyanBright.bold('netlify deploy')}`)

  persistState({ state, siteInfo })

  return exit()
}

const logGitSetupInstructionsAndExit = (): never => {
  log()
  log(`${chalk.bold('To initialize a new git repo follow the steps below.')}

1. Initialize a new repo:

   ${chalk.cyanBright.bold('git init')}

2. Add your files

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
  return exit()
}

/**
 * Handles the case where no git remote was found.
 */
const handleNoGitRemoteAndExit = async ({
  command,
  error,
  state,
}: {
  command: BaseCommand
  error?: unknown
  state: CLIState
}): Promise<never> => {
  log()
  log(chalk.yellow('No git remote was found, would you like to set one up?'))
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

  const { noGitRemoteChoice } = await inquirer.prompt<{ noGitRemoteChoice: typeof NEW_SITE_NO_GIT | typeof NO_ABORT }>([
    {
      type: 'list',
      name: 'noGitRemoteChoice',
      message: 'Do you want to create a Netlify site without a git repository?',
      choices: [NEW_SITE_NO_GIT, NO_ABORT],
    },
  ])

  if (noGitRemoteChoice === NEW_SITE_NO_GIT) {
    return await createNewSiteAndExit({ state, command })
  }
  return logGitSetupInstructionsAndExit()
}

/**
 * Creates a new site or links an existing one to the repository
 */
const createOrLinkSiteToRepo = async (command: BaseCommand) => {
  const NEW_SITE = '+  Create & configure a new site'
  const EXISTING_SITE = '⇄  Connect this directory to an existing Netlify site'

  const initializeOpts = [EXISTING_SITE, NEW_SITE] as const

  // TODO(serhalp): inquirer should infer the choice type here, but doesn't. Fix.
  const { initChoice } = await inquirer.prompt<{ initChoice: typeof initializeOpts[number] }>([
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
  // run link command
  return await link({}, command)
}

const logExistingRepoSetupAndExit = ({ repoUrl, siteName }: { repoUrl: string; siteName: string }): void => {
  log()
  log(chalk.underline.bold(`Success`))
  log(`This site "${siteName}" is configured to automatically deploy via ${repoUrl}`)
  // TODO add support for changing GitHub repo in site:config command
  exit()
}

export const init = async (options: OptionValues, command: BaseCommand): Promise<SiteInfo> => {
  command.setAnalyticsPayload({ manual: options.manual, force: options.force })

  const { repositoryRoot, state } = command.netlify
  const { siteInfo: existingSiteInfo } = command.netlify

  // Check logged in status
  await command.authenticate()

  // Add .netlify to .gitignore file
  await ensureNetlifyIgnore(repositoryRoot)

  const repoUrl = getRepoUrl(existingSiteInfo)
  if (repoUrl && !options.force) {
    logExistingAndExit({ siteInfo: existingSiteInfo })
  }

  // Look for local repo
  const repoData = await getRepoData({ workingDir: command.workingDir, remoteName: options.gitRemoteName })
  if ('error' in repoData) {
    return await handleNoGitRemoteAndExit({ command, error: repoData.error, state })
  }

  const siteInfo = isEmpty(existingSiteInfo) ? await createOrLinkSiteToRepo(command) : existingSiteInfo

  log()

  // Check for existing CI setup
  const remoteBuildRepo = getRepoUrl(siteInfo)
  if (remoteBuildRepo && !options.force) {
    logExistingRepoSetupAndExit({ siteName: siteInfo.name, repoUrl: remoteBuildRepo })
  }

  persistState({ state, siteInfo })

  await configureRepo({ command, siteId: siteInfo.id, repoData, manual: options.manual })

  return siteInfo
}
