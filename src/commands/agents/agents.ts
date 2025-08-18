import type { OptionValues } from 'commander'
import terminalLink from 'terminal-link'

import { chalk } from '../../utils/command-helpers.js'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.js'
import type BaseCommand from '../base-command.js'

const agents = (_options: OptionValues, command: BaseCommand) => {
  command.help()
}

export const createAgentsCommand = (program: BaseCommand) => {
  program
    .command('agents:create')
    .alias('agents:run')
    .argument('[prompt]', 'the prompt for the agent to execute')
    .description('Create and run a new agent runner on your site')
    .option('-p, --prompt <prompt>', 'agent prompt')
    .option('-a, --agent <agent>', 'agent type (claude, gemini, codex)', 'codex')
    .option('-m, --model <model>', 'model to use for the agent')
    .option('-b, --branch <branch>', 'git branch to work on')
    .option('--json', 'output result as JSON')
    .hook('preAction', requiresSiteInfo)
    .addExamples([
      'netlify agents:create',
      'netlify agents:create "Fix the login bug"',
      'netlify agents:create --prompt "Add dark mode" --agent claude',
      'netlify agents:create -p "Update README" -a gemini -b feature-branch',
    ])
    .action(async (prompt: string, options: OptionValues, command: BaseCommand) => {
      const { agentsCreate } = await import('./agents-create.js')
      await agentsCreate(prompt, options, command)
    })

  program
    .command('agents:list')
    .description('List agent runners for the current site')
    .option('--json', 'output result as JSON')
    .option('-s, --status <status>', 'filter by status (new, running, done, error, cancelled)')
    .hook('preAction', requiresSiteInfo)
    .addExamples(['netlify agents:list', 'netlify agents:list --status running', 'netlify agents:list --json'])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { agentsList } = await import('./agents-list.js')
      await agentsList(options, command)
    })

  program
    .command('agents:show')
    .argument('<id>', 'agent runner ID to show')
    .description('Show details of a specific agent runner')
    .option('--json', 'output result as JSON')
    .hook('preAction', requiresSiteInfo)
    .addExamples([
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a',
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --json',
    ])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsShow } = await import('./agents-show.js')
      await agentsShow(id, options, command)
    })

  program
    .command('agents:stop')
    .argument('<id>', 'agent runner ID to stop')
    .description('Stop a running agent runner')
    .option('--json', 'output result as JSON')
    .hook('preAction', requiresSiteInfo)
    .addExamples(['netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a'])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsStop } = await import('./agents-stop.js')
      await agentsStop(id, options, command)
    })

  const name = chalk.greenBright('`agents`')

  return program
    .command('agents')
    .description(
      `Manage Netlify agent runners
The ${name} command will help you run AI agents on your Netlify sites to automate development tasks`,
    )
    .addExamples([
      'netlify agents:create --prompt "Add a contact form"',
      'netlify agents:list --status running',
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a',
    ])
    .addHelpText('afterAll', () => {
      const docsUrl = 'https://docs.netlify.com/agents/'
      return `
For more information about Netlify Agent Runners, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}

Note: Agent runners execute remotely on Netlify's infrastructure, not locally.
`
    })
    .action(agents)
}
