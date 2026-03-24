import { execFile as execFileCb } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdir, rm, unlink, readdir } from 'fs/promises'
import path from 'path'
import process from 'process'
import readline from 'readline'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'

import type { OptionValues } from 'commander'
import extractZip from 'extract-zip'
import inquirer from 'inquirer'
import fetch from 'node-fetch'

import type { NetlifyAPI } from '@netlify/api'
import { LocalState } from '@netlify/dev-utils'
import { Octokit } from '@octokit/rest'

import { chalk, logAndThrowError, log, logJson, warn, type APIError } from '../../utils/command-helpers.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { getGitHubToken as promptForGitHubToken } from '../../utils/gh-auth.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import { track } from '../../utils/telemetry/index.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner } from '../agents/types.js'
import { validatePrompt, validateAgent, formatStatus } from '../agents/utils.js'
import type { SiteInfo } from '../../utils/types.js'

const execFile = promisify(execFileCb)

const resolveGitHubToken = async (globalConfig: {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
}): Promise<string> => {
  const userId = globalConfig.get('userId') as string | undefined
  if (userId) {
    const cached = globalConfig.get(`users.${userId}.auth.github`) as { token?: string; user?: string } | undefined
    if (cached?.token) {
      try {
        const octokit = new Octokit({ auth: `token ${cached.token}` })
        await octokit.rest.users.getAuthenticated()
        return cached.token
      } catch {
        // Token expired or invalid, fall through to re-auth
      }
    }
  }

  const newToken = await promptForGitHubToken()
  if (userId) {
    globalConfig.set(`users.${userId}.auth.github`, newToken)
  }
  return newToken.token
}

interface ApiClient {
  accessToken?: string | null
  host: string
}

interface ApiOptions {
  scheme?: string
  host?: string
  userAgent: string
}

interface CreateOptions extends OptionValues {
  prompt?: string
  agent?: string
  model?: string
  name?: string
  dir?: string
  accountSlug?: string
  git?: string
  repoOwner?: string
  download?: boolean
  wait?: boolean
}

const POLL_INTERVAL = 2000
const TERMINAL_STATES = ['done', 'error', 'cancelled']

const fetchAgentRunner = async (id: string, api: NetlifyAPI): Promise<AgentRunner> => {
  const result = await api.getAgentRunner({ agent_runner_id: id })
  return result as unknown as AgentRunner
}

const readMultilineInput = (): Promise<string> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const lines: string[] = []
    rl.on('line', (line) => {
      if (line === '' && lines.length > 0) {
        rl.close()
        return
      }
      lines.push(line)
    })
    rl.on('close', () => {
      resolve(lines.join('\n').trim())
    })
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const downloadAndExtractSource = async (deployId: string, projectDir: string, api: ApiClient, apiOpts: ApiOptions) => {
  const urlResponse = await fetch(
    `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/deploys/${deployId}/download`,
    {
      headers: {
        Authorization: `Bearer ${api.accessToken ?? ''}`,
        'User-Agent': apiOpts.userAgent,
      },
    },
  )

  if (!urlResponse.ok) {
    throw new Error(`Failed to get source download URL (HTTP ${urlResponse.status.toString()})`)
  }

  const { url } = (await urlResponse.json()) as { url: string }

  const zipResponse = await fetch(url, { redirect: 'follow' })
  if (!zipResponse.ok || !zipResponse.body) {
    throw new Error(`Failed to download source zip (HTTP ${zipResponse.status.toString()})`)
  }

  await mkdir(projectDir, { recursive: true })

  const tmpFile = path.join(projectDir, '_source.zip')
  await pipeline(zipResponse.body, createWriteStream(tmpFile))
  try {
    await extractZip(tmpFile, { dir: projectDir })
  } finally {
    await unlink(tmpFile)
  }
}

const selectRepoOwner = async (ghToken: string, repoOwnerFlag?: string): Promise<string> => {
  if (repoOwnerFlag) {
    return repoOwnerFlag
  }

  const octokit = new Octokit({ auth: `token ${ghToken}` })
  const { data: user } = await octokit.rest.users.getAuthenticated()
  const { data: orgs } = await octokit.rest.orgs.listForAuthenticatedUser()

  if (orgs.length === 0) {
    return user.login
  }

  const choices = [
    { name: `${user.login} (personal)`, value: user.login },
    ...orgs.map((org) => ({ name: org.login, value: org.login })),
  ]

  const { owner } = await inquirer.prompt<{ owner: string }>([
    {
      type: 'list',
      name: 'owner',
      message: 'Where should the GitHub repo be created?',
      choices,
    },
  ])

  return owner
}

const createGitHubRepo = async (
  siteId: string,
  repoName: string,
  providerToken: string,
  repoOwner: string,
  api: ApiClient,
  apiOpts: ApiOptions,
) => {
  const body: Record<string, unknown> = {
    provider: 'github',
    provider_token: providerToken,
    repo_name: repoName,
    repo_owner: repoOwner,
    private: true,
    create_initial_commit: true,
  }

  const response = await fetch(
    `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/sites/${siteId}/repo`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${api.accessToken ?? ''}`,
        'Content-Type': 'application/json',
        'User-Agent': apiOpts.userAgent,
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
  }

  return (await response.json()) as SiteInfo
}

const PUSH_TERMINAL_STATES = ['complete', 'failed']

const PUSH_STATE_LABELS: Record<string, string> = {
  pending: 'Preparing to push to GitHub...',
  fetching_files: 'Fetching source files...',
  pushing: 'Pushing to GitHub...',
}

const pollRepoPush = async (
  siteId: string,
  api: NetlifyAPI,
  spinner: { update: (opts: { text: string }) => void },
): Promise<SiteInfo> => {
  let lastState = ''

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    await sleep(POLL_INTERVAL)

    const siteData = (await api.getSite({ siteId })) as unknown as SiteInfo
    const progress = siteData.git_initial_push_progress

    if (progress && progress.state !== lastState) {
      lastState = progress.state
      const label = PUSH_STATE_LABELS[progress.state]
      if (label) {
        spinner.update({ text: label })
      }
    }

    if (progress && PUSH_TERMINAL_STATES.includes(progress.state)) {
      if (progress.state === 'failed') {
        throw new Error(progress.error_message ?? 'Push to GitHub failed')
      }
      return siteData
    }

    if (!progress && siteData.repo?.repo_path) {
      return siteData
    }
  }
}

export const createAction = async (promptArg: string, options: CreateOptions, command: BaseCommand) => {
  const { accounts, api, apiOpts } = command.netlify

  await command.authenticate()

  const { prompt, agent: initialAgent, model, name: siteName, dir, accountSlug: accountSlugFlag } = options

  // Resolve prompt
  let finalPrompt: string
  if (!prompt && !promptArg) {
    log(chalk.bold('What do you want to build? Type out the prompt for your project:'))
    log(chalk.dim('(Press Enter on an empty line to submit)'))
    finalPrompt = await readMultilineInput()
  } else {
    finalPrompt = (promptArg || prompt) ?? ''
  }

  const promptIsValid = validatePrompt(finalPrompt)
  if (promptIsValid !== true) {
    return logAndThrowError(promptIsValid)
  }

  // Resolve agent (default to claude)
  const agent = initialAgent ?? 'claude'
  const agentIsValid = validateAgent(agent)
  if (agentIsValid !== true) {
    return logAndThrowError(agentIsValid)
  }

  // Resolve team
  let accountSlug: string | undefined
  if (accountSlugFlag) {
    accountSlug = accountSlugFlag
  } else if (accounts.length > 1) {
    const { accountSlug: selected } = await inquirer.prompt<{ accountSlug: string }>([
      {
        type: 'list',
        name: 'accountSlug',
        message: 'Team:',
        choices: accounts.map((account) => ({
          value: account.slug,
          name: account.name,
        })),
      },
    ])
    accountSlug = selected
  } else {
    accountSlug = accounts[0]?.slug
  }

  if (!accountSlug) {
    return logAndThrowError('No account found. Please log in first.')
  }

  // Step 1: Create site (with retry on name collision)
  const MAX_NAME_RETRIES = 2
  const siteSpinner = startSpinner({ text: 'Creating project...' })

  let site: SiteInfo
  let nameAttempt = siteName
  let retries = 0

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    try {
      const body: Record<string, unknown> = { created_via: 'agent_runner' }
      if (nameAttempt && nameAttempt !== 'undefined') {
        body.name = nameAttempt.trim()
      }

      site = (await api.createSiteInTeam({
        accountSlug,
        body,
      })) as unknown as SiteInfo

      stopSpinner({ spinner: siteSpinner })
      log(`${chalk.green('✓')} Project created: ${chalk.cyan(site.name)}`)
      break
    } catch (error_) {
      if ((error_ as APIError).status === 422 && siteName && retries < MAX_NAME_RETRIES) {
        retries++
        const suffix = Math.floor(Math.random() * 900 + 100).toString()
        nameAttempt = `${siteName}-${suffix}`
        warn(`${siteName}.netlify.app already exists. Trying ${nameAttempt}...`)
        continue
      }
      stopSpinner({ spinner: siteSpinner, error: true })
      if ((error_ as APIError).status === 422) {
        const name = nameAttempt ?? siteName
        return logAndThrowError(
          name
            ? `Project name "${name}" is already taken. Please try a different name.`
            : `Failed to create project: ${(error_ as Error).message}`,
        )
      }
      return logAndThrowError(`Failed to create project: ${(error_ as Error).message}`)
    }
  }

  // Step 2: Create agent runner
  const agentSpinner = startSpinner({ text: 'Starting agent...' })

  let agentRunner: AgentRunner
  try {
    const agentRunnerUrl = new URL(
      `/api/v1/agent_runners`,
      `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}`,
    )
    agentRunnerUrl.searchParams.set('site_id', site.id)

    const response = await fetch(agentRunnerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${api.accessToken ?? ''}`,
        'Content-Type': 'application/json',
        'User-Agent': apiOpts.userAgent,
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        agent,
        ...(model ? { model } : {}),
        mode: 'create',
      }),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
    }

    agentRunner = (await response.json()) as AgentRunner
    stopSpinner({ spinner: agentSpinner })
  } catch (error_) {
    stopSpinner({ spinner: agentSpinner, error: true })
    return logAndThrowError(`Failed to start agent: ${(error_ as Error).message}`)
  }

  const agentRunUrl = `https://app.netlify.com/projects/${site.name}/agent-runs/${agentRunner.id}`
  const agentRunCreateUrl = `${agentRunUrl}/create`
  const showCmd = `netlify agents:show ${agentRunner.id} --project ${site.name}`

  // --no-wait: return immediately with status info
  if (options.wait === false) {
    void track('sites_createStarted', {
      siteId: site.id,
      agentRunnerId: agentRunner.id,
      noWait: true,
    })

    if (options.json) {
      logJson({
        site: {
          id: site.id,
          name: site.name,
          admin_url: site.admin_url,
        },
        agentRunner: {
          id: agentRunner.id,
          state: agentRunner.state,
          url: agentRunCreateUrl,
        },
      })
      return
    }

    log()
    log(`${chalk.green('✓')} Agent run started! The agent is now building your site in the background.`)
    log()
    log(chalk.bold('Next steps:'))
    log(`  View progress in the browser:`)
    log(`    ${chalk.blue(agentRunCreateUrl)}`)
    log()
    log(`  Check status from the CLI:`)
    log(`    ${chalk.cyan(showCmd)}`)
    log()
    log(
      chalk.dim(
        "The agent typically takes a few minutes to complete. You'll be able to see the site URL once it's done.",
      ),
    )
    log()
    return
  }

  // Step 3: Poll for completion
  const pollSpinner = startSpinner({ text: 'Agent is working...' })
  let lastTask = ''

  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      await sleep(POLL_INTERVAL)

      const runner = await fetchAgentRunner(agentRunner.id, api)

      if (runner.current_task && runner.current_task !== lastTask) {
        lastTask = runner.current_task
        pollSpinner.update({ text: `Agent: ${runner.current_task}` })
      }

      if (TERMINAL_STATES.includes(runner.state ?? '')) {
        agentRunner = runner
        break
      }
    }
  } catch (error_) {
    stopSpinner({ spinner: pollSpinner, error: true })
    log()
    log(`  View details: ${chalk.blue(agentRunUrl)}`)
    return logAndThrowError(`Error polling agent status: ${(error_ as Error).message}`)
  }

  stopSpinner({ spinner: pollSpinner })

  // Fetch final site info for URL
  let finalSite: SiteInfo
  try {
    finalSite = (await api.getSite({ siteId: site.id })) as unknown as SiteInfo
  } catch {
    finalSite = site
  }

  let githubRepoPath: string | undefined

  const siteUrl = finalSite.ssl_url || finalSite.url

  void track('sites_createCompleted', {
    siteId: site.id,
    agentRunnerId: agentRunner.id,
    state: agentRunner.state,
  })

  if (options.json) {
    logJson({
      site: {
        id: site.id,
        name: site.name,
        url: siteUrl,
        admin_url: site.admin_url,
      },
      agentRunner: {
        id: agentRunner.id,
        state: agentRunner.state,
        url: agentRunUrl,
      },
    })
    return
  }

  if (agentRunner.state === 'done') {
    log(`${chalk.green('✓')} Agent run complete!`)

    // Step 4: Download source and link project
    const projectDir = path.resolve(dir || '.', site.name)
    const relativeDir = path.relative(command.workingDir, projectDir) || '.'

    let downloaded = false
    if (options.download !== false && agentRunner.latest_session_deploy_id) {
      let dirExists = false
      try {
        const entries = await readdir(projectDir)
        dirExists = entries.length > 0
      } catch {
        // Directory doesn't exist, which is what we want
      }

      if (dirExists) {
        warn(`Directory ${relativeDir} already exists and is not empty. Skipping source download.`)
      } else {
        const downloadSpinner = startSpinner({ text: 'Downloading source...' })
        try {
          await downloadAndExtractSource(agentRunner.latest_session_deploy_id, projectDir, api, apiOpts)
          stopSpinner({ spinner: downloadSpinner })
          log(`${chalk.green('✓')} Source downloaded to ${chalk.cyan(relativeDir)}`)

          const state = new LocalState(projectDir)
          state.set('siteId', site.id)
          await ensureNetlifyIgnore(projectDir)
          log(`${chalk.green('✓')} Project linked to ${chalk.cyan(site.name)}`)
          downloaded = true
        } catch (error_) {
          stopSpinner({ spinner: downloadSpinner, error: true })
          await rm(projectDir, { recursive: true, force: true }).catch(() => {})
          warn(`Failed to download source: ${(error_ as Error).message}`)
        }
      }
    } else if (options.download !== false && !agentRunner.latest_session_deploy_id) {
      warn('No deploy found for this agent run. Skipping source download.')
    }

    // Step 5: Create GitHub repo and push source
    if (options.git) {
      if (options.git !== 'github') {
        warn(`Unsupported git provider "${options.git}". Only "github" is supported.`)
      } else {
        try {
          const ghToken = await resolveGitHubToken(command.netlify.globalConfig)
          const repoOwner = await selectRepoOwner(ghToken, options.repoOwner)
          const repoSpinner = startSpinner({ text: 'Creating GitHub repository...' })
          try {
            await createGitHubRepo(site.id, site.name, ghToken, repoOwner, api, apiOpts)
            repoSpinner.update({ text: 'Pushing source to GitHub...' })
            await pollRepoPush(site.id, api, repoSpinner)
            stopSpinner({ spinner: repoSpinner })

            githubRepoPath = `${repoOwner}/${site.name}`
            log(`${chalk.green('✓')} GitHub repo created: ${chalk.cyan(`https://github.com/${githubRepoPath}`)}`)

            if (downloaded) {
              try {
                const repoUrl = `https://github.com/${githubRepoPath}.git`
                await execFile('git', ['init'], { cwd: projectDir })
                await execFile('git', ['remote', 'add', 'origin', repoUrl], { cwd: projectDir })
                await execFile('git', ['fetch', 'origin'], { cwd: projectDir })
                await execFile('git', ['reset', 'origin/main'], { cwd: projectDir })
                await execFile('git', ['branch', '-u', 'origin/main'], { cwd: projectDir })
                log(`${chalk.green('✓')} Git repository initialized`)
              } catch {
                // Non-fatal: local git init is best-effort
              }
            }
          } catch (error_) {
            stopSpinner({ spinner: repoSpinner, error: true })
            warn(`Failed to create GitHub repo: ${(error_ as Error).message}`)
          }
        } catch (error_) {
          warn(`GitHub authentication failed: ${(error_ as Error).message}`)
        }
      }
    }

    log()
    log(`  Site URL:  ${chalk.cyan(siteUrl)}`)
    log(`  Admin URL: ${chalk.blue(site.admin_url)}`)
    if (githubRepoPath) {
      log(`  Repo URL:  ${chalk.blue(`https://github.com/${githubRepoPath}`)}`)
    }
    log()
    if (downloaded) {
      log(chalk.bold('Next steps:'))
      log(`  cd ${chalk.cyan(relativeDir)} and start making changes`)
      if (githubRepoPath) {
        log('  When ready, push your changes to your repo and Netlify will automatically deploy your changes')
      } else {
        log(`  When ready, run ${chalk.cyan('netlify deploy')} to publish your new changes`)
      }
      log()
    }
  } else {
    log(`${chalk.red('✗')} Agent run ${formatStatus(agentRunner.state ?? 'error')}`)
    log()
    log(`  View details: ${chalk.blue(agentRunUrl)}`)
  }
  log()
}
