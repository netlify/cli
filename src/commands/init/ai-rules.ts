import { resolve } from 'node:path'
import { promises as fs } from 'node:fs'
import type { NetlifyAPI } from '@netlify/api'

import {
  chalk,
  log,
  logPadded,
  logAndThrowError,
  type APIError,
  NETLIFY_CYAN,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  NETLIFYDEVERR,
} from '../../utils/command-helpers.js'
import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js'
import { runGit } from '../../utils/run-git.js'
import { startSpinner } from '../../lib/spinner.js'
import { detectIDE } from '../../recipes/ai-context/index.js'
import { type ConsumerConfig } from '../../recipes/ai-context/context.js'
import {
  generateMcpConfig,
  configureMcpForVSCode,
  configureMcpForCursor,
  configureMcpForWindsurf,
  showGenericMcpConfig,
} from '../../utils/mcp-utils.js'
import type BaseCommand from '../base-command.js'
import type { SiteInfo } from '../../utils/types.js'
import inquirer from 'inquirer'

const SPARK_URL = process.env.SPARK_URL ?? 'https://spark.netlify.app'
const AI_SITE_PROMPT_GEN_URL = `${SPARK_URL}/site-prompt-gen`
const DOCS_URL = process.env.DOCS_URL ?? 'https://docs.netlify.com'

/**
 * Project information interface for AI projects
 */
interface ProjectInfo {
  success: boolean
  projectId: string
  prompt: string
}

// Trigger IDE-specific MCP configuration
const triggerMcpConfiguration = async (ide: ConsumerConfig, projectPath: string): Promise<boolean> => {
  log(`\n${chalk.blue('🔧 MCP Configuration for')} ${NETLIFY_CYAN(ide.presentedName)}`)

  const { shouldConfigure } = await inquirer.prompt<{ shouldConfigure: boolean }>([
    {
      type: 'confirm',
      name: 'shouldConfigure',
      message: `Would you like to automatically configure the MCP server for ${ide.presentedName}?`,
      default: true,
    },
  ])

  if (!shouldConfigure) {
    log(`   ${chalk.dim('You can configure MCP manually later for enhanced AI capabilities:')}`)
    log(
      `   ${chalk.dim('Documentation:')} ${NETLIFY_CYAN(
        'https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server/',
      )}`,
    )

    return false
  }

  try {
    const config = generateMcpConfig(ide)

    // IDE-specific configuration actions
    switch (ide.key) {
      case 'vscode':
        await configureMcpForVSCode(config, projectPath)
        break
      case 'cursor':
        await configureMcpForCursor(config, projectPath)
        break
      case 'windsurf':
        await configureMcpForWindsurf(config, projectPath)
        break
      default:
        showGenericMcpConfig(config, ide.presentedName)
    }

    log(`${NETLIFYDEVLOG} MCP configuration completed for ${NETLIFY_CYAN(ide.presentedName)}`)
    return true
  } catch (error) {
    log(`${NETLIFYDEVERR} Failed to configure MCP: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

const fetchProjectInfo = async (url: string): Promise<ProjectInfo> => {
  try {
    const response = await fetch(url, {
      headers: {
        'content-type': 'text/plain',
      },
    })

    const data = (await response.text()) as unknown as string
    const parsedData = JSON.parse(data) as unknown as ProjectInfo
    return parsedData
  } catch (error) {
    throw new Error(`Failed to fetch project information: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const getRepoUrlFromProjectId = async (api: NetlifyAPI, projectId: string): Promise<string> => {
  try {
    const siteInfo = (await api.getSite({ siteId: projectId })) as SiteInfo
    const repoUrl = siteInfo.build_settings?.repo_url

    if (!repoUrl) {
      throw new Error(`No repository URL found for project ID: ${projectId}`)
    }

    return repoUrl
  } catch (error) {
    if ((error as APIError).status === 404) {
      throw new Error(`Project with ID ${projectId} not found`)
    }
    throw new Error(`Failed to fetch project data: ${(error as Error).message}`)
  }
}

const savePrompt = async (instructions: string, ntlContext: string | null, targetDir: string): Promise<void> => {
  try {
    const filePath = resolve(targetDir, 'AI-instructions.md')
    await fs.writeFile(filePath, `Context: ${ntlContext ?? ''}\n\n${instructions}`, 'utf-8')
    log(`${NETLIFYDEVLOG} AI instructions saved to ${NETLIFY_CYAN('AI-instructions.md')}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log(`${NETLIFYDEVWARN} Warning: Failed to save AI instructions: ${errorMessage}`)
  }
}

const cloneRepo = async (repoUrl: string, targetDir: string, debug: boolean): Promise<void> => {
  try {
    await runGit(['clone', repoUrl, targetDir], !debug)
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : error?.toString() ?? ''}`)
  }
}

/**
 * Handles AI rules initialization workflow
 * This is the experimental --ai-rules functionality for the init command
 */
export const initWithAiRules = async (hash: string, command: BaseCommand): Promise<void> => {
  // Authenticate first before any API operations
  await command.authenticate()
  const { api } = command.netlify

  log(`${NETLIFY_CYAN('🤖 Initializing AI project')} with rules...`)
  log(`${NETLIFY_CYAN('User:')} ${api.accessToken ? 'Authenticated ✅' : 'Not authenticated ❌'}`)

  try {
    // Step 1: Decode hash and fetch project information
    log('\n📋 Extracting project details...')
    const decodedUrl = `${AI_SITE_PROMPT_GEN_URL}/${hash}`
    log(`${NETLIFY_CYAN('Decoded URL:')} ${decodedUrl}`)

    log('\n🔍 Fetching project information...')
    const projectInfo = await fetchProjectInfo(decodedUrl)

    // Step 2: Get repository URL from project ID via Netlify site API
    log('\n🔗 Linking to Netlify project and fetching repository...')
    const repositoryUrl = await getRepoUrlFromProjectId(api, projectInfo.projectId)

    // Step 3: Clone repository
    const { repoUrl, repoName } = normalizeRepoUrl(repositoryUrl)
    const targetDir = `ai-project-${repoName}-${hash.substring(0, 8)}`

    const cloneSpinner = startSpinner({ text: `Cloning repository to ${NETLIFY_CYAN(targetDir)}` })

    await cloneRepo(repoUrl, targetDir, false)
    cloneSpinner.success({ text: `Cloned repository to ${NETLIFY_CYAN(targetDir)}` })

    // Step 4: Save AI instructions to file
    if (projectInfo.prompt) {
      const ntlContext = await fetch(`${DOCS_URL}/ai-context/scoped-context?scopes=serverless,blobs,forms`)
        .then((res) => res.text())
        .catch(() => {
          return null
        })
      log('\n📝 Saving AI instructions...')
      await savePrompt(projectInfo.prompt, ntlContext, targetDir)
    }

    // Step 5: Detect IDE and configure MCP server
    log('\n🔍 Detecting development environment...')
    const detectedIDE = await detectIDE()
    let mcpConfigured = false

    if (detectedIDE) {
      log(`${NETLIFYDEVLOG} Detected development environment: ${NETLIFY_CYAN(detectedIDE.presentedName)}`)
      mcpConfigured = await triggerMcpConfiguration(detectedIDE, targetDir)
    }

    // Update working directory to cloned repo
    process.chdir(targetDir)
    command.workingDir = targetDir

    // Success message with next steps
    log()
    log(`${NETLIFYDEVLOG} Your AI project is ready to go!`)
    log(`→ Project cloned to: ${NETLIFY_CYAN(targetDir)}`)
    if (projectInfo.prompt) {
      log(`→ AI instructions saved: ${NETLIFY_CYAN('AI-instructions.md')}`)
    }
    log()
    log(`${NETLIFYDEVWARN} Step 1: Enter your project directory`)
    log(`   ${NETLIFY_CYAN(`cd ${targetDir}`)}`)

    if (detectedIDE) {
      if (mcpConfigured) {
        log(`${NETLIFYDEVWARN} Step 2: MCP Server Configured`)
        log(`   ${NETLIFYDEVLOG} ${NETLIFY_CYAN(detectedIDE.key)} is ready with Netlify MCP server`)
        log(`   ${chalk.dim('💡 MCP will activate when you reload/restart your development environment')}`)
      } else {
        log(`${NETLIFYDEVWARN} Step 2: Manual MCP Configuration`)
        log(`   ${NETLIFY_CYAN(detectedIDE.key)} detected - MCP setup was skipped`)
        log(`   ${chalk.dim('You can configure MCP manually later for enhanced AI capabilities:')}`)
        log(
          `   ${chalk.dim('Documentation:')} ${NETLIFY_CYAN(
            `${DOCS_URL}/welcome/build-with-ai/netlify-mcp-server/`,
          )}`,
        )
      }
      log()
    }

    if (projectInfo.prompt) {
      const stepNumber = detectedIDE ? '3' : '2'
      log(`${NETLIFYDEVWARN} Step ${stepNumber}: Ask your AI assistant to process the instructions`)
      log()
      logPadded(NETLIFY_CYAN(`Follow ${targetDir}/AI-instructions.md and create a new site`))
      log()
    }
  } catch (error) {
    return logAndThrowError(error)
  }
}
