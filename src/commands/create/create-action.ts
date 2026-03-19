import { execFile as execFileCb } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdir, rm, unlink, readdir } from 'fs/promises'
import path from 'path'
import process from 'process'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'

import type { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { LocalState } from '@netlify/dev-utils'

import { chalk, logAndThrowError, log, logJson, warn, type APIError } from '../../utils/command-helpers.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import { track } from '../../utils/telemetry/index.js'
import type BaseCommand from '../base-command.js'
import type { AgentRunner } from '../agents/types.js'
import { validatePrompt, validateAgent, formatStatus } from '../agents/utils.js'
import { AVAILABLE_AGENTS } from '../agents/constants.js'
import type { SiteInfo } from '../../utils/types.js'

const execFile = promisify(execFileCb)

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
  download?: boolean
  wait?: boolean
}

const POLL_INTERVAL = 2000
const TERMINAL_STATES = ['done', 'error', 'cancelled']

const fetchAgentRunner = async (id: string, api: ApiClient, apiOpts: ApiOptions): Promise<AgentRunner> => {
  const response = await fetch(
    `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners/${id}`,
    {
      headers: {
        Authorization: `Bearer ${api.accessToken ?? ''}`,
        'User-Agent': apiOpts.userAgent,
      },
    },
  )

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`)
  }

  return (await response.json()) as AgentRunner
}

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
    if (process.platform === 'win32') {
      await execFile('powershell.exe', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Force -LiteralPath '${tmpFile}' -DestinationPath '${projectDir}'`,
      ])
    } else {
      await execFile('unzip', ['-o', tmpFile, '-d', projectDir])
    }
  } finally {
    await unlink(tmpFile)
  }
}

export const createAction = async (promptArg: string, options: CreateOptions, command: BaseCommand) => {
  const { accounts, api, apiOpts } = command.netlify

  await command.authenticate()

  const { prompt, agent: initialAgent, model, name: siteName, dir, accountSlug: accountSlugFlag } = options

  // Resolve prompt
  let finalPrompt: string
  if (!prompt && !promptArg) {
    const { promptInput } = await inquirer.prompt<{ promptInput: string }>([
      {
        type: 'input',
        name: 'promptInput',
        message: 'Describe the site you want to create:',
        validate: validatePrompt,
      },
    ])
    finalPrompt = promptInput
  } else {
    finalPrompt = (promptArg || prompt) ?? ''
  }

  const promptIsValid = validatePrompt(finalPrompt)
  if (promptIsValid !== true) {
    return logAndThrowError(promptIsValid)
  }

  // Resolve agent
  let agent = initialAgent
  if (!agent) {
    const { agentInput } = await inquirer.prompt<{ agentInput: string }>([
      {
        type: 'list',
        name: 'agentInput',
        message: 'Which agent would you like to use?',
        choices: AVAILABLE_AGENTS,
        default: 'claude',
      },
    ])
    agent = agentInput
  } else {
    const agentIsValid = validateAgent(agent)
    if (agentIsValid !== true) {
      return logAndThrowError(agentIsValid)
    }
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
      if (nameAttempt) {
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
        return logAndThrowError(
          `Project name "${String(nameAttempt ?? siteName)}" is already taken. Please try a different name.`,
        )
      }
      return logAndThrowError(`Failed to create project: ${(error_ as Error).message}`)
    }
  }

  // Step 2: Create agent runner
  const agentSpinner = startSpinner({ text: 'Starting agent...' })

  let agentRunner: AgentRunner
  try {
    const createParams = new URLSearchParams()
    createParams.set('site_id', site.id)

    const response = await fetch(
      `${apiOpts.scheme ?? 'https'}://${apiOpts.host ?? api.host}/api/v1/agent_runners?${createParams.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${api.accessToken ?? ''}`,
          'Content-Type': 'application/json',
          'User-Agent': apiOpts.userAgent,
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          agent,
          model,
          mode: 'create',
        }),
      },
    )

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
    void track('create_started', {
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

      const runner = await fetchAgentRunner(agentRunner.id, api, apiOpts)

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

  const siteUrl = finalSite.ssl_url || finalSite.url

  void track('create_completed', {
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

  log()
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
          return logAndThrowError(`Failed to download source: ${(error_ as Error).message}`)
        }
      }
    } else if (options.download !== false && !agentRunner.latest_session_deploy_id) {
      warn('No deploy found for this agent run. Skipping source download.')
    }

    log()
    log(`  Site URL:  ${chalk.cyan(siteUrl)}`)
    log(`  Admin URL: ${chalk.blue(site.admin_url)}`)
    log()
    if (downloaded) {
      log(chalk.bold('Next steps:'))
      log(`  cd ${chalk.cyan(relativeDir)} and start making changes`)
      log(`  When ready, run ${chalk.cyan('netlify deploy')} to publish your new changes`)
      log()
    }
  } else {
    log(`${chalk.red('✗')} Agent run ${formatStatus(agentRunner.state ?? 'error')}`)
    log()
    log(`  View details: ${chalk.blue(agentRunUrl)}`)
  }
  log()
}
