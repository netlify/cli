import type { OptionValues } from 'commander'

import { chalk } from '../../utils/command-helpers.js'
import requiresSiteInfoWithProject from '../../utils/hooks/requires-site-info-with-project.js'
import type BaseCommand from '../base-command.js'

const agents = (_options: OptionValues, command: BaseCommand) => {
  command.help()
}

export const createAgentsCommand = (program: BaseCommand) => {
  program
    .command('agents:create')
    .alias('agents:run')
    .argument('[prompt]', 'the prompt for the agent to execute')
    .description('Create and run a new agent task on your site')
    .option('-p, --prompt <prompt>', 'agent prompt')
    .option('-a, --agent <agent>', 'agent type (claude, codex, gemini)')
    .option('-m, --model <model>', 'model to use for the agent')
    .option('-b, --branch <branch>', 'git branch to work on')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .option('--json', 'output result as JSON')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples([
      'netlify agents:create',
      'netlify agents:create "Fix the login bug"',
      'netlify agents:create --prompt "Add dark mode" --agent claude',
      'netlify agents:create -p "Update README" -a codex -b feature-branch',
      'netlify agents:create "Add tests" --project my-site-name',
    ])
    .action(async (prompt: string, options: OptionValues, command: BaseCommand) => {
      const { agentsCreate } = await import('./agents-create.js')
      await agentsCreate(prompt, options, command)
    })

  program
    .command('agents:list')
    .description('List agent tasks for the current site')
    .option('--json', 'output result as JSON')
    .option('-s, --status <status>', 'filter by status (new, running, done, error, cancelled)')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples(['netlify agents:list', 'netlify agents:list --status running', 'netlify agents:list --json'])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { agentsList } = await import('./agents-list.js')
      await agentsList(options, command)
    })

  program
    .command('agents:show')
    .argument('<id>', 'agent task ID to show')
    .description('Show details of a specific agent task')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
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
    .argument('<id>', 'agent task ID to stop')
    .description('Stop a running agent task')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples(['netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a'])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsStop } = await import('./agents-stop.js')
      await agentsStop(id, options, command)
    })

  const name = chalk.greenBright('`agents`')

  return program
    .command('agents')
    .description(
      `Manage Netlify AI agent tasks
The ${name} command will help you run AI agents on your Netlify sites to automate development tasks

Note: Agent tasks execute remotely on Netlify infrastructure, not locally.`,
    )
    .addExamples([
      'netlify agents:create --prompt "Add a contact form"',
      'netlify agents:list --status running',
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a',
    ])
    .action(agents)
}
