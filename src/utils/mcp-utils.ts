import { resolve } from 'node:path'
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { chalk, log, NETLIFY_CYAN, NETLIFYDEVLOG, NETLIFYDEVWARN } from './command-helpers.js'
import type { ConsumerConfig } from '../recipes/ai-context/context.js'

/**
 * Generate MCP configuration for the detected IDE or development environment
 */
export const generateMcpConfig = (ide: ConsumerConfig): Record<string, unknown> => {
  const configs: Record<string, Record<string, unknown>> = {
    vscode: {
      servers: {
        netlify: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@netlify/mcp'],
        },
      },
    },
    cursor: {
      mcpServers: {
        netlify: {
          command: 'npx',
          args: ['-y', '@netlify/mcp'],
        },
      },
    },
    windsurf: {
      mcpServers: {
        netlify: {
          command: 'npx',
          args: ['-y', '@netlify/mcp'],
        },
      },
    },
  }

  return (
    configs[ide.key] ?? {
      mcpServers: {
        netlify: {
          command: 'npx',
          args: ['-y', '@netlify/mcp'],
        },
      },
    }
  )
}

/**
 * VS Code specific MCP configuration
 */
export const configureMcpForVSCode = async (config: Record<string, unknown>, projectPath: string): Promise<void> => {
  const vscodeDirPath = resolve(projectPath, '.vscode')
  const configPath = resolve(vscodeDirPath, 'mcp.json')

  try {
    // Create .vscode directory if it doesn't exist
    await fs.mkdir(vscodeDirPath, { recursive: true })

    // Write or update mcp.json
    let existingConfig: Record<string, unknown> = {}
    try {
      const existingContent = await fs.readFile(configPath, 'utf-8')
      existingConfig = JSON.parse(existingContent) as Record<string, unknown>
    } catch {
      // File doesn't exist or is invalid JSON
    }

    const updatedConfig = { ...existingConfig, ...config }

    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
    log(`${NETLIFYDEVLOG} VS Code MCP configuration saved to ${NETLIFY_CYAN('.vscode/mcp.json')}`)
  } catch (error) {
    throw new Error(`Failed to configure VS Code MCP: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Cursor specific MCP configuration
 */
export const configureMcpForCursor = async (config: Record<string, unknown>, projectPath: string): Promise<void> => {
  const configPath = resolve(projectPath, '.cursor', 'mcp.json')

  try {
    await fs.mkdir(resolve(projectPath, '.cursor'), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    log(`${NETLIFYDEVLOG} Cursor MCP configuration saved to ${NETLIFY_CYAN('.cursor/mcp.json')}`)
  } catch (error) {
    throw new Error(`Failed to configure Cursor MCP: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Windsurf specific MCP configuration
 */
export const configureMcpForWindsurf = async (config: Record<string, unknown>, _projectPath: string): Promise<void> => {
  const windsurfDirPath = resolve(homedir(), '.codeium', 'windsurf')
  const configPath = resolve(windsurfDirPath, 'mcp_config.json')

  try {
    // Create .codeium/windsurf directory if it doesn't exist
    await fs.mkdir(windsurfDirPath, { recursive: true })

    // Read existing config or create new one
    let existingConfig: Record<string, unknown> = {}
    try {
      const existingContent = await fs.readFile(configPath, 'utf-8')
      existingConfig = JSON.parse(existingContent) as Record<string, unknown>
    } catch {
      // File doesn't exist or is invalid JSON
    }

    // Merge mcpServers from both configs
    const existingServers = (existingConfig.mcpServers as Record<string, unknown> | undefined) ?? {}
    const newServers = (config.mcpServers as Record<string, unknown> | undefined) ?? {}

    const updatedConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingServers,
        ...newServers,
      },
    }

    await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
    log(`${NETLIFYDEVLOG} Windsurf MCP configuration saved`)
    log(`${chalk.dim('💡')} Restart Windsurf to activate the MCP server`)
  } catch (error) {
    throw new Error(`Failed to configure Windsurf MCP: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generic MCP configuration display
 */
export const showGenericMcpConfig = (config: Record<string, unknown>, ideName: string): void => {
  log(`\n${NETLIFYDEVWARN} Manual configuration required`)
  log(`Please add the following configuration to your ${ideName} settings:`)
  log(`\n${chalk.dim('--- Configuration ---')}`)
  log(JSON.stringify(config, null, 2))
  log(`${chalk.dim('--- End Configuration ---')}\n`)
}
