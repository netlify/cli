import { OptionValues } from 'commander'

import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js'
import { runGit } from '../../utils/run-git.js'
import { startSpinner } from '../../lib/spinner.js'
import BaseCommand from '../base-command.js'

interface MockHashDecodeResult {
  siteId?: string
  repoUrl?: string
  targetDir?: string
  branch?: string
}

// Mock hash decoding - in real implementation this would decode the actual hash
const mockDecodeHash = (hash: string): MockHashDecodeResult => {
  // Mock: If hash starts with 'site_', treat it as a site ID
  // Otherwise, treat it as a direct repo URL
  if (hash.startsWith('site_')) {
    return {
      siteId: hash.replace('site_', ''),
      targetDir: `ai-project-${hash.substring(0, 8)}`,
      branch: 'main'
    }
  } else {
    return {
      repoUrl: 'https://github.com/netlify/netlify-cli.git', // Mock repo
      targetDir: `ai-project-${hash.substring(0, 8)}`,
      branch: 'main'
    }
  }
}

// Get repository URL from site ID using existing API functionality
const getRepoUrlFromSiteId = async (api: any, siteId: string): Promise<string> => {
  try {
    const siteData = await api.getSite({ siteId })
    
    const repoUrl = siteData.build_settings?.repo_url
    
    if (!repoUrl) {
      throw new Error(`No repository URL found for site ID: ${siteId}`)
    }
    
    return repoUrl
    
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error(`Project with ID ${siteId} not found`)
    }
    throw new Error(`Failed to fetch project data: ${error.message}`)
  }
}

// Mock server response for now
const mockServerRequest = async (hash: string, _authToken: string) => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // Mock successful response
  return {
    success: true,
    message: 'AI project initialization started successfully',
    projectId: '4d6c8c75-2278-409e-bcb7-06e07b79e1bc',
    status: 'processing',
    estimatedTime: '2-3 minutes',
    dashboardUrl: `https://app.netlify.com/ai/projects/proj_${hash.substring(0, 8)}`
  }
}

const cloneRepo = async (repoUrl: string, targetDir: string, debug: boolean): Promise<void> => {
  try {
    await runGit(['clone', repoUrl, targetDir], !debug)
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : error?.toString() ?? ''}`)
  }
}

export const aiStartCommand = async (options: OptionValues, command: BaseCommand) => {
  const hash = command.args[0]

  // Validate hash parameter
  if (!hash) {
    log(`${chalk.red('Error:')} Hash parameter is required`)
    log(`${chalk.gray('Usage:')} netlify ai:start <hash>`)
    return
  }

  // Check authentication - this will automatically handle login if needed
  await command.authenticate()
  
  const { api } = command.netlify

  log(`${chalk.blue('🤖 AI Start')} - Initializing AI project...`)
  log(`${chalk.gray('Hash:')} ${hash}`)
  log(`${chalk.gray('User:')} ${api.accessToken ? 'Authenticated ✅' : 'Not authenticated ❌'}`)

  // Step 1: Decode hash to get repository information
  log('\n📋 Decoding project hash...')
  const hashResult = mockDecodeHash(hash)
  
  let finalRepoUrl: string
  
  // Step 1a: If hash contains site ID, fetch repository URL from Netlify API
  if (hashResult.siteId) {
    log(`${chalk.cyan('Site ID:')} ${hashResult.siteId}`)
    log('🔍 Fetching repository information from Netlify...')
    
    try {
      finalRepoUrl = await getRepoUrlFromSiteId(api, hashResult.siteId)
      log(`${chalk.cyan('Repository:')} ${finalRepoUrl}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      log(chalk.red('❌ Error:'), errorMessage)
      return
    }
  } else if (hashResult.repoUrl) {
    // Direct repository URL provided
    finalRepoUrl = hashResult.repoUrl
    log(`${chalk.cyan('Repository:')} ${finalRepoUrl}`)
  } else {
    log(chalk.red('❌ Error: No repository information found in hash'))
    return
  }
  
  log(`${chalk.cyan('Target Directory:')} ${hashResult.targetDir ?? 'auto-generated'}`)
  if (hashResult.branch) {
    log(`${chalk.cyan('Branch:')} ${hashResult.branch}`)
  }

  // Step 2: Clone repository using existing functionality
  try {
    const { repoUrl, repoName } = normalizeRepoUrl(finalRepoUrl)
    const targetDir = hashResult.targetDir ?? `ai-project-${repoName}-${hash.substring(0, 8)}`

    const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` })
    
    try {
      await cloneRepo(repoUrl, targetDir, Boolean(options.debug))
      cloneSpinner.success({ text: `Cloned repository to ${chalk.cyan(targetDir)}` })
    } catch (error) {
      cloneSpinner.error()
      return logAndThrowError(error)
    }

    // Update working directory to cloned repo
    command.workingDir = targetDir
    process.chdir(targetDir)

    // Step 3: Send request to AI server for project setup
    log('\n🚀 Sending request to AI server...')
    const response = await mockServerRequest(hash, api.accessToken ?? '')

    if (response.success) {
      log(`\n${chalk.green('✅ Success!')} ${response.message}`)
      log(`${chalk.cyan('Project ID:')} ${response.projectId}`)
      log(`${chalk.cyan('Status:')} ${response.status}`)
      log(`${chalk.cyan('Estimated Time:')} ${response.estimatedTime}`)
      
      if (response.dashboardUrl) {
        log(`${chalk.cyan('Dashboard:')} ${response.dashboardUrl}`)
      }

      // Success message with next steps
      log()
      log(chalk.green('✔ Your AI project is ready to go!'))
      log(`→ Project cloned to: ${chalk.cyanBright(targetDir)}`)
      log(`→ Enter your project directory: ${chalk.cyanBright(`cd ${targetDir}`)}`)
      log(`→ AI setup is processing in the background`)
      log(`→ Check progress at: ${chalk.cyanBright(response.dashboardUrl)}`)
      log()

    } else {
      log(chalk.red('❌ Failed to start AI project'))
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    log(chalk.red('❌ Error:'), errorMessage)
    log(chalk.gray('Please try again or contact support if the issue persists.'))
  }
}