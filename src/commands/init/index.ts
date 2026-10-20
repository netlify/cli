import { OptionValues } from 'commander'
import terminalLink from 'terminal-link'

import BaseCommand from '../base-command.js'

export const createInitCommand = (program: BaseCommand) =>
  program
    .command('init')
    .description(
      'Configure continuous deployment for a new or existing project. To create a new project without continuous deployment, use `netlify sites:create`',
    )
    .option('-m, --manual', 'Manually configure a git remote for CI')
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .option(
      '--skip-agent-setup',
      'Skip installing Netlify skills and adding the Netlify MCP server for AI coding agents',
    )
    .option('--skip-mcp-setup', 'Skip adding the Netlify MCP server to your AI coding agents')
    .option(
      '--reset-mcp-setup',
      'Forget your saved Netlify MCP server choices and ask which AI coding agents to set up',
    )
    .option(
      '--reset-context',
      'Replace locally edited Netlify skills with the latest release, and migrate or delete edited copies under renamed or deprecated names',
    )
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/get-started/'
      return `
For more information about getting started with Netlify CLI, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`
    })
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { init } = await import('./init.js')
      await init(options, command, {
        setupAgentSkills: !options.skipAgentSetup,
        setupAgentMcp: !options.skipAgentSetup && !options.skipMcpSetup,
        resetMcpSetup: Boolean(options.resetMcpSetup),
        resetContext: Boolean(options.resetContext),
      })
    })
