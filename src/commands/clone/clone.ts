import { resolve } from 'path'

import inquirer from 'inquirer'

import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js'
import { chalk, logAndThrowError, log, getToken, netlifyCommand, type APIError } from '../../utils/command-helpers.js'
import { runGit } from '../../utils/run-git.js'
import execa from '../../utils/execa.js'
import type BaseCommand from '../base-command.js'
import { NETLIFY_GIT_HOST } from '../git-credential/git-credential.js'
import { link } from '../link/link.js'
import type { CloneOptionValues } from './option_values.js'
import { startSpinner } from '../../lib/spinner.js'
import type { SiteInfo } from '../../utils/types.js'

const NETLIFY_GIT_SERVICE_HOST = 'hgit.services-prod.nsvcs.net'

const isNetlifyGitServiceUrl = (repoUrl: string): boolean => {
  try {
    const host = new URL(repoUrl).host
    return host === NETLIFY_GIT_HOST || host === NETLIFY_GIT_SERVICE_HOST
  } catch {
    return false
  }
}

const getTargetDir = async (defaultDir: string): Promise<string> => {
  const { selectedDir } = await inquirer.prompt<{ selectedDir: string }>([
    {
      type: 'input',
      name: 'selectedDir',
      message: 'Where should we clone the repository?',
      default: defaultDir,
    },
  ])

  return selectedDir
}

const cloneRepo = async (repoUrl: string, targetDir: string, debug: boolean): Promise<void> => {
  try {
    await runGit(['clone', repoUrl, targetDir], !debug)
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : (error?.toString() ?? '')}`)
  }
}

// Under `npx`/`pnpx`/`npm exec`, `process.argv[1]` points into a temp cache dir that
// gets cleaned up, so a git credential helper pinned to that path breaks after the
// fact. Fall back to the resolved invocation (e.g. `npx netlify`) in that case.
export const getCredentialHelper = (): string => {
  const cliCommand = netlifyCommand()
  const invocation = cliCommand === 'netlify' ? `'${process.execPath}' '${resolve(process.argv[1])}'` : cliCommand
  return `!${invocation} git-credential`
}

const configureGitAuth = async (repoDir: string): Promise<void> => {
  await execa('git', ['config', `credential.https://${NETLIFY_GIT_HOST}.helper`, ''], { cwd: repoDir })
  await execa('git', ['config', '--add', `credential.https://${NETLIFY_GIT_HOST}.helper`, getCredentialHelper()], {
    cwd: repoDir,
  })
  await execa('git', ['config', 'http.postBuffer', '524288000'], { cwd: repoDir })
}

const cloneFromNetlifyGit = async (repoUrl: string, targetDir: string, debug: boolean): Promise<void> => {
  try {
    await execa(
      'git',
      [
        '-c',
        `credential.https://${NETLIFY_GIT_HOST}.helper=`,
        '-c',
        `credential.https://${NETLIFY_GIT_HOST}.helper=${getCredentialHelper()}`,
        'clone',
        repoUrl,
        targetDir,
      ],
      {
        ...(debug ? {} : { stdio: 'pipe' }),
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to clone repository: ${message}`)
  }
}

const parseNetlifySiteInput = (input: string): { isNetlifySite: true; siteName: string } | { isNetlifySite: false } => {
  const netlifyAppUrlRegex = /^https?:\/\/([^.]+)\.netlify\.app\/?$/
  const netlifyAppUrlMatch = netlifyAppUrlRegex.exec(input)
  if (netlifyAppUrlMatch) {
    return { isNetlifySite: true, siteName: netlifyAppUrlMatch[1] }
  }

  const appNetlifyUrlRegex = /^https?:\/\/app\.netlify\.com\/(?:sites|projects)\/([^/]+)\/?/
  const appNetlifyUrlMatch = appNetlifyUrlRegex.exec(input)
  if (appNetlifyUrlMatch) {
    return { isNetlifySite: true, siteName: appNetlifyUrlMatch[1] }
  }

  if (!input.includes('/') && !input.includes(':') && !input.includes('.')) {
    return { isNetlifySite: true, siteName: input }
  }

  return { isNetlifySite: false }
}

// FIXME(serhalp): This suffers from the same egregious performance problem as `link`/`init`.
// We should fix it rather than keep spreading it.
const lookupSiteByName = async (api: BaseCommand['netlify']['api'], siteName: string): Promise<SiteInfo | null> => {
  try {
    const sites = await api.listSites({ name: siteName, filter: 'all' })
    const site = sites.find((s) => s.name === siteName)
    return site ? (site as SiteInfo) : null
  } catch (error) {
    if ((error as APIError).status === 404) {
      return null
    }
    throw error
  }
}

const finalizeClone = async (
  options: CloneOptionValues,
  command: BaseCommand,
  workingDir: string,
  linkOverrides: { id?: string; name?: string; gitRemoteUrl?: string },
): Promise<void> => {
  command.workingDir = workingDir
  // TODO(serhalp): This shouldn't be necessary but `getPathInProject` does not take
  // `command.workingDir` into account. Carefully fix this and remove this line.
  process.chdir(workingDir)

  const { id, name, ...globalOptions } = options
  await link({ ...globalOptions, ...linkOverrides }, command)
}

const logCloneSuccess = (
  targetDir: string,
  { credentialsConfigured = false, devCommand }: { credentialsConfigured?: boolean; devCommand?: string } = {},
): void => {
  log()
  log(chalk.green('✔ Your project is ready to go!'))
  log(`→ Next, enter your project directory using ${chalk.cyanBright(`cd ${targetDir}`)}`)
  log()
  log(`→ You can now run other ${chalk.cyanBright('netlify')} CLI commands in this directory`)
  if (credentialsConfigured) {
    log(`Git is configured to use your Netlify credentials for this repository.`)
  }
  log(`→ To build and deploy your project: ${chalk.cyanBright('netlify deploy')}`)
  if (devCommand) {
    log(`→ To run your dev server: ${chalk.cyanBright(devCommand)}`)
  }
  log(`→ To see all available commands: ${chalk.cyanBright('netlify help')}`)
  log()
}

const cloneFromNetlifyGitService = async (
  options: CloneOptionValues,
  command: BaseCommand,
  args: { repo: string; targetDir?: string },
  siteInfo: SiteInfo,
): Promise<void> => {
  const [token] = await getToken()
  if (!token) {
    return logAndThrowError(
      `No authentication token found. Run ${chalk.cyanBright('netlify login')} to authenticate first.`,
    )
  }

  const accountSlug = siteInfo.account_slug
  const siteSlug = siteInfo.name

  if (!accountSlug || !siteSlug) {
    return logAndThrowError('Could not determine account or site slug from the site.')
  }

  const repoUrl = `https://${NETLIFY_GIT_HOST}/${accountSlug}/${siteSlug}.git`
  const targetDir = args.targetDir ?? (await getTargetDir(`./${siteSlug}`))
  const resolvedTargetDir = resolve(targetDir)

  log(`Remote: ${chalk.dim(repoUrl)}`)

  const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` })

  try {
    await cloneFromNetlifyGit(repoUrl, resolvedTargetDir, options.debug ?? false)
  } catch (error) {
    cloneSpinner.error()
    return logAndThrowError(error)
  }

  cloneSpinner.success(`Cloned repository to ${chalk.cyan(targetDir)}`)

  const configSpinner = startSpinner({ text: 'Configuring git credentials' })

  try {
    await configureGitAuth(resolvedTargetDir)
  } catch (error) {
    configSpinner.error()
    return logAndThrowError(error)
  }

  configSpinner.success('Configured git credentials')

  await finalizeClone(options, command, resolvedTargetDir, { id: siteInfo.id })
  logCloneSuccess(targetDir, { credentialsConfigured: true })
}

export const clone = async (
  options: CloneOptionValues,
  command: BaseCommand,
  args: { repo: string; targetDir?: string },
) => {
  await command.authenticate()

  const { api } = command.netlify
  const parsedInput = parseNetlifySiteInput(args.repo)

  if (parsedInput.isNetlifySite) {
    const siteSpinner = startSpinner({ text: `Looking up site ${chalk.cyan(parsedInput.siteName)}...` })

    const siteInfo = await lookupSiteByName(api, parsedInput.siteName)

    if (!siteInfo) {
      siteSpinner.error()
      return logAndThrowError(`Could not find a Netlify site named "${parsedInput.siteName}"`)
    }

    siteSpinner.success(`Found site ${chalk.cyan(siteInfo.name)}`)

    const connectedRepoUrl = siteInfo.build_settings?.repo_url

    if (connectedRepoUrl && isNetlifyGitServiceUrl(connectedRepoUrl)) {
      log(`Site is connected to Netlify's managed git service.`)
      log(`Cloning from Netlify's managed git service...`)
      log()

      return cloneFromNetlifyGitService(options, command, args, siteInfo)
    }

    if (connectedRepoUrl) {
      log(`Site has a connected repository: ${chalk.dim(connectedRepoUrl)}`)
      log(`Cloning from the connected repository...`)
      log()

      const { repoUrl, repoName } = normalizeRepoUrl(connectedRepoUrl)
      const targetDir = args.targetDir ?? (await getTargetDir(`./${repoName}`))

      const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` })
      try {
        await cloneRepo(repoUrl, targetDir, options.debug ?? false)
      } catch (error) {
        cloneSpinner.error()
        return logAndThrowError(error)
      }
      cloneSpinner.success(`Cloned repository to ${chalk.cyan(targetDir)}`)

      await finalizeClone(options, command, targetDir, { id: siteInfo.id, gitRemoteUrl: connectedRepoUrl })
      logCloneSuccess(targetDir)
    } else {
      log(`Site does not have a connected repository.`)
      log(`Cloning from Netlify's managed git service...`)
      log()

      return cloneFromNetlifyGitService(options, command, args, siteInfo)
    }
  } else {
    const { repoUrl, httpsUrl, repoName } = normalizeRepoUrl(args.repo)

    const targetDir = args.targetDir ?? (await getTargetDir(`./${repoName}`))

    const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` })
    try {
      await cloneRepo(repoUrl, targetDir, options.debug ?? false)
    } catch (error) {
      cloneSpinner.error()
      return logAndThrowError(error)
    }
    cloneSpinner.success(`Cloned repository to ${chalk.cyan(targetDir)}`)

    await finalizeClone(options, command, targetDir, { id: options.id, name: options.name, gitRemoteUrl: httpsUrl })
    logCloneSuccess(targetDir, { devCommand: command.netlify.config.dev?.command })
  }
}
