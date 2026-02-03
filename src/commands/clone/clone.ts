import { resolve } from 'path'

import inquirer from 'inquirer'

import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js'
import { chalk, logAndThrowError, log, getToken } from '../../utils/command-helpers.js'
import { runGit } from '../../utils/run-git.js'
import execa from '../../utils/execa.js'
import type BaseCommand from '../base-command.js'
import { link } from '../link/link.js'
import type { CloneOptionValues } from './option_values.js'
import { startSpinner } from '../../lib/spinner.js'
import type { SiteInfo } from '../../utils/types.js'

const AGENTGIT_HOST = 'agentgit.netlify.app'

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
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : error?.toString() ?? ''}`)
  }
}

const getNetlifyCliPath = (): string => {
  return process.argv[1]
}

const configureGitAuth = async (repoDir: string): Promise<void> => {
  const cliPath = getNetlifyCliPath()
  await execa('git', ['config', `credential.https://${AGENTGIT_HOST}.helper`, ''], { cwd: repoDir })
  await execa(
    'git',
    ['config', '--add', `credential.https://${AGENTGIT_HOST}.helper`, `!${cliPath} git-credential`],
    { cwd: repoDir },
  )
}

const redactToken = (message: string, token: string): string => {
  return message.replaceAll(token, '[REDACTED]')
}

const cloneFromAgentGit = async (
  repoUrl: string,
  targetDir: string,
  token: string,
  debug: boolean,
): Promise<void> => {
  try {
    await execa(
      'git',
      [
        '-c',
        `http.https://${AGENTGIT_HOST}.extraHeader=Authorization: Bearer ${token}`,
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
    throw new Error(`Failed to clone repository: ${redactToken(message, token)}`)
  }
}

const parseNetlifySiteInput = (
  input: string,
): { isNetlifySite: true; siteName: string } | { isNetlifySite: false } => {
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

const lookupSiteByName = async (api: BaseCommand['netlify']['api'], siteName: string): Promise<SiteInfo | null> => {
  try {
    const sites = await api.listSites({ name: siteName, filter: 'all' })
    const site = sites.find((s) => s.name === siteName)
    return site ? (site as SiteInfo) : null
  } catch {
    return null
  }
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

      command.workingDir = targetDir
      process.chdir(targetDir)

      const { id, name, ...globalOptions } = options
      const linkOptions = {
        ...globalOptions,
        id: siteInfo.id,
        gitRemoteUrl: connectedRepoUrl,
      }
      await link(linkOptions, command)

      log()
      log(chalk.green('✔ Your project is ready to go!'))
      log(`→ Next, enter your project directory using ${chalk.cyanBright(`cd ${targetDir}`)}`)
      log()
      log(`→ You can now run other ${chalk.cyanBright('netlify')} CLI commands in this directory`)
      log(`→ To build and deploy your project: ${chalk.cyanBright('netlify deploy')}`)
      log(`→ To see all available commands: ${chalk.cyanBright('netlify help')}`)
      log()
    } else {
      log(`Site does not have a connected repository.`)
      log(`Cloning from Netlify's managed git service...`)
      log()

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

      const repoUrl = `https://${AGENTGIT_HOST}/${accountSlug}/${siteSlug}.git`
      const targetDir = args.targetDir ?? (await getTargetDir(`./${siteSlug}`))
      const resolvedTargetDir = resolve(targetDir)

      log(`Remote: ${chalk.dim(repoUrl)}`)

      const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` })

      try {
        await cloneFromAgentGit(repoUrl, resolvedTargetDir, token, options.debug ?? false)
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

      command.workingDir = resolvedTargetDir
      process.chdir(resolvedTargetDir)

      const { id, name, ...globalOptions } = options
      const linkOptions = {
        ...globalOptions,
        id: siteInfo.id,
      }
      await link(linkOptions, command)

      log()
      log(chalk.green('✔ Your project is ready to go!'))
      log(`→ Next, enter your project directory using ${chalk.cyanBright(`cd ${targetDir}`)}`)
      log()
      log(`→ You can now run other ${chalk.cyanBright('netlify')} CLI commands in this directory`)
      log(`Git is configured to use your Netlify credentials for this repository.`)
      log(`→ To build and deploy your project: ${chalk.cyanBright('netlify deploy')}`)
      log(`→ To see all available commands: ${chalk.cyanBright('netlify help')}`)
      log()
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

    command.workingDir = targetDir
    process.chdir(targetDir)

    const { id, name, ...globalOptions } = options
    const linkOptions = {
      ...globalOptions,
      id,
      name,
      gitRemoteUrl: httpsUrl,
    }
    await link(linkOptions, command)

    log()
    log(chalk.green('✔ Your project is ready to go!'))
    log(`→ Next, enter your project directory using ${chalk.cyanBright(`cd ${targetDir}`)}`)
    log()
    log(`→ You can now run other ${chalk.cyanBright('netlify')} CLI commands in this directory`)
    log(`→ To build and deploy your project: ${chalk.cyanBright('netlify deploy')}`)
    if (command.netlify.config.dev?.command) {
      log(`→ To run your dev server: ${chalk.cyanBright(command.netlify.config.dev.command)}`)
    }
    log(`→ To see all available commands: ${chalk.cyanBright('netlify help')}`)
    log()
  }
}
