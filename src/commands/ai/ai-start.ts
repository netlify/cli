import { OptionValues } from 'commander'

import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js'
import { runGit } from '../../utils/run-git.js'
import { startSpinner } from '../../lib/spinner.js'
import BaseCommand from '../base-command.js'

// Decode hash to get the encoded URL
const decodeHash = (hash: string): string => {
  // In real implementation, this would decode the hash to get the actual URL
  // For now, return a mock URL
  return 'https://api.netlify.com/api/v1/ai/projects/mock-endpoint'
}

interface ProjectInfo {
  success: boolean
  projectId: string
  aiInstructions: string
}

// Call the decoded URL to get project information
const fetchProjectInfo = async (url: string, authToken: string): Promise<ProjectInfo> => {
  try {
    // Mock response for now - in real implementation, fetch from the decoded URL
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock response with project ID and AI instructions (no repository URL)
    return {
      success: true,
      projectId: '4d6c8c75-2278-409e-bcb7-06e07b79e1bc',
      aiInstructions: `# AI Project Instructions

This is your AI-powered project setup guide.

## Getting Started

1. Review the project structure
2. Install dependencies: \`npm install\`
3. Start development: \`netlify dev\`
4. Deploy your project: \`netlify deploy\`

## AI Features

- Automated code analysis
- Smart deployment optimizations
- Performance monitoring
- Error detection and suggestions

## Next Steps

- Configure your build settings
- Set up environment variables
- Explore the AI dashboard for insights

Happy coding! 🚀`
    }
  } catch (error) {
    throw new Error(`Failed to fetch project information: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get repository URL from project ID using existing site API functionality
const getRepoUrlFromProjectId = async (api: any, projectId: string): Promise<string> => {
  try {
    // Use project ID as site ID to get site data
    const siteData = await api.getSite({ siteId: projectId })
    
    const repoUrl = siteData.build_settings?.repo_url
    
    if (!repoUrl) {
      throw new Error(`No repository URL found for project ID: ${projectId}`)
    }
    
    return repoUrl
    
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error(`Project with ID ${projectId} not found`)
    }
    throw new Error(`Failed to fetch project data: ${error.message}`)
  }
}

// Save AI instructions to markdown file
const saveAiInstructions = async (instructions: string, targetDir: string): Promise<void> => {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  
  try {
    const filePath = path.resolve(targetDir, 'AI-instructions.md')
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

  // Step 1: Decode hash and fetch project information
  log('\n📋 Decoding project hash...')
  const decodedUrl = decodeHash(hash)
  log(`${chalk.cyan('Decoded URL:')} ${decodedUrl}`)
  
  log('\n🔍 Fetching project information...')
  let projectInfo: ProjectInfo
  try {
    projectInfo = await fetchProjectInfo(decodedUrl, api.accessToken ?? '')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log(chalk.red('❌ Error:'), errorMessage)
    return
  }

  if (!projectInfo.success) {
    log(chalk.red('❌ Failed to fetch project information'))
    return
  }

  log(`${chalk.cyan('Project ID:')} ${projectInfo.projectId}`)

  // Step 2: Get repository URL from project ID via Netlify site API
  log('\n🔗 Linking to Netlify site and fetching repository...')
  let repositoryUrl: string
  try {
    repositoryUrl = await getRepoUrlFromProjectId(api, projectInfo.projectId)
    log(`${chalk.cyan('Repository:')} ${repositoryUrl}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log(chalk.red('❌ Error:'), errorMessage)
    return
  }

  // Step 3: Clone repository using existing functionality
  try {
    const { repoUrl, repoName } = normalizeRepoUrl(repositoryUrl)
    const targetDir = `ai-project-${repoName}-${hash.substring(0, 8)}`

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

    // Step 4: Save AI instructions to file
    if (projectInfo.aiInstructions) {
      log('\n📝 Saving AI instructions...')
      // Use command working directory which is now set to the cloned repo
      await saveAiInstructions(projectInfo.aiInstructions, command.workingDir)
    }

    // Success message with next steps
    log()
    log(chalk.green('✔ Your AI project is ready to go!'))
    log(`→ Project ID: ${chalk.cyanBright(projectInfo.projectId)}`)
    log(`→ Project cloned to: ${chalk.cyanBright(targetDir)}`)
    if (projectInfo.aiInstructions) {
      log(`→ AI instructions saved: ${chalk.cyanBright('AI-instructions.md')}`)
    }
    log()
    log(chalk.yellowBright(`📁 Step 1: Enter your project directory`))
    log(`   ${chalk.cyanBright(`cd ${targetDir}`)}`)
    log()
    if (projectInfo.aiInstructions) {
      log(chalk.yellowBright(`🤖 Step 2: Ask your AI assistant to process the instructions`))
      log(`   ${chalk.gray('Tell your AI:')} ${chalk.cyanBright('"Please read and follow the AI-instructions.md file"')}`)
      log()
    }
    log(chalk.yellowBright(`🚀 Step 3: Start development`))
    log(`   ${chalk.cyanBright('netlify dev')} ${chalk.gray('- Start local development server')}`)
    log(`   ${chalk.cyanBright('netlify deploy')} ${chalk.gray('- Deploy your project')}`)
    log()
    log(chalk.gray(`💡 Pro tip: Your AI assistant can help you understand and implement`))
    log(chalk.gray(`   the project-specific instructions in AI-instructions.md`))
    log()

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    log(chalk.red('❌ Error:'), errorMessage)
    log(chalk.gray('Please try again or contact support if the issue persists.'))
  }
}