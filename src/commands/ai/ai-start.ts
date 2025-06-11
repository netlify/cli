import type { OptionValues } from 'commander'
import { resolve } from 'node:path'
import { promises as fs } from 'node:fs'
import type { NetlifyAPI } from '@netlify/api'

import { chalk, log, logAndThrowError, type APIError } from '../../utils/command-helpers.js'
import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js'
import { runGit } from '../../utils/run-git.js'
import { startSpinner } from '../../lib/spinner.js'
import type BaseCommand from '../base-command.js'
import type { SiteInfo } from '../../utils/types.js'

interface ProjectInfo {
  success: boolean
  projectId: string
  prompt: string
}

interface AIStartOptions extends OptionValues {
  debug?: boolean
}

// Move helper functions to a separate utils file
const decodeHash = (hash: string): string => {
  try {
    return atob(hash)
  } catch (error) {
    throw new Error(`Failed to decode hash: ${error instanceof Error ? error.message : 'Invalid base64 or URL'}`)
  }
}

const fetchProjectInfo = async (url: string): Promise<ProjectInfo> => {
  try {
    const response = await fetch(url, {
      headers: {
        'content-type': 'text/plain',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${String(response.status)}`)
    }
    const data = (await response.text()) as unknown as string
    const parsedData = JSON.parse(data) as unknown as ProjectInfo
    return parsedData
  } catch (error) {
    throw new Error(`Failed to fetch project information: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

const getRepoUrlFromProjectId = async (api: NetlifyAPI, projectId: string): Promise<string> => {
  try {
    const SiteInfo = (await api.getSite({ siteId: projectId })) as SiteInfo
    const repoUrl = SiteInfo.build_settings?.repo_url

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

const saveprompt = async (instructions: string, targetDir: string): Promise<void> => {
  try {
    const filePath = resolve(targetDir, 'AI-instructions.md')
    await fs.writeFile(filePath, instructions, 'utf-8')
    log(`${chalk.green('✅')} AI instructions saved to ${chalk.cyan('AI-instructions.md')}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log(`${chalk.yellow('⚠️')} Warning: Failed to save AI instructions: ${errorMessage}`)
  }
}

const cloneRepo = async (repoUrl: string, targetDir: string, debug: boolean): Promise<void> => {
  try {
    await runGit(['clone', repoUrl, targetDir], !debug)
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : error?.toString() ?? ''}`)
  }
}

export const aiStartCommand = async (options: AIStartOptions, command: BaseCommand): Promise<void> => {
  const hash = command.args[0]

  // Validate hash parameter
  if (!hash) {
    log(`${chalk.red('Error:')} Hash parameter is required`)
    log(`${chalk.gray('Usage:')} netlify ai:start <hash>`)
    return
  }

  // Authenticate first before any API operations
  await command.authenticate()
  const { api } = command.netlify

  log(`${chalk.blue('🤖 AI Start')} - Initializing AI project...`)
  log(`${chalk.gray('Hash:')} ${hash}`)
  log(`${chalk.gray('User:')} ${api.accessToken ? 'Authenticated ✅' : 'Not authenticated ❌'}`)

  try {
    // Step 1: Decode hash and fetch project information
    log('\n📋 Decoding project hash...')
    const decodedUrl = decodeHash(hash)
    log(`${chalk.cyan('Decoded URL:')} ${decodedUrl}`)

    log('\n🔍 Fetching project information...')
    const projectInfo = await fetchProjectInfo(decodedUrl)

    log(`${chalk.cyan('Project ID:')} ${projectInfo.projectId}`)

    // Step 2: Get repository URL from project ID via Netlify site API
    log('\n🔗 Linking to Netlify site and fetching repository...')
    const repositoryUrl = await getRepoUrlFromProjectId(api, projectInfo.projectId)
    log(`${chalk.cyan('Repository:')} ${repositoryUrl}`)

    // Step 3: Clone repository
    const { repoUrl, repoName } = normalizeRepoUrl(repositoryUrl)
    const targetDir = `ai-project-${repoName}-${hash.substring(0, 8)}`

    const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` })

    await cloneRepo(repoUrl, targetDir, Boolean(options.debug))
    cloneSpinner.success({ text: `Cloned repository to ${chalk.cyan(targetDir)}` })

    // Step 4: Save AI instructions to file
    if (projectInfo.prompt) {
      log('\n📝 Saving AI instructions...')
      await saveprompt(projectInfo.prompt, targetDir)
    }

    // Update working directory to cloned repo
    process.chdir(targetDir)
    command.workingDir = targetDir
    // Success message with next steps
    log()
    log(chalk.green('✔ Your AI project is ready to go!'))
    log(`→ Project ID: ${chalk.cyanBright(projectInfo.projectId)}`)
    log(`→ Project cloned to: ${chalk.cyanBright(targetDir)}`)
    if (projectInfo.prompt) {
      log(`→ AI instructions saved: ${chalk.cyanBright('AI-instructions.md')}`)
    }
    log()
    log(chalk.yellowBright(`📁 Step 1: Enter your project directory`))
    log(`   ${chalk.cyanBright(`cd ${targetDir}`)}`)
    log()
    if (projectInfo.prompt) {
      log(chalk.yellowBright(`🤖 Step 2: Ask your AI assistant to process the instructions`))
      log(`   ${chalk.cyanBright(`follow instructions in ${targetDir}/AI-instructions.md`)}`)
    }
  } catch (error) {
    return logAndThrowError(error)
  }
}
