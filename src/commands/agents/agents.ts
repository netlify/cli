import type { OptionValues } from 'commander'

import { chalk } from '../../utils/command-helpers.js'
import requiresSiteInfoWithProject from '../../utils/hooks/requires-site-info-with-project.js'
import type BaseCommand from '../base-command.js'

const collect = (value: string, previous: string[] = []): string[] => [...previous, value]

const agents = (_options: OptionValues, command: BaseCommand) => {
  command.help()
}

export const createAgentsCommand = (program: BaseCommand) => {
  program
    .command('agents:create')
    .alias('agents:run')
    .argument('[prompt]', 'the prompt for the agent to execute')
    .description('Create and start a new agent run on your site')
    .option('-p, --prompt <prompt>', 'agent prompt')
    .option('-a, --agent <agent>', 'agent type (claude, codex, gemini)')
    .option('-m, --model <model>', 'model to use for the agent')
    .option('-b, --branch <branch>', 'git branch to work on')
    .option('--from-deploy <deployId>', 'start the agent from a specific deploy (mutually exclusive with --branch)')
    .option('--parent <id>', 'chain this agent run off of another agent run')
    .option('--attach <path>', 'attach a file or image (repeatable)', collect, [])
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .option('--json', 'output result as JSON')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples([
      'netlify agents:create',
      'netlify agents:create "Fix the login bug"',
      'netlify agents:create --prompt "Add dark mode" --agent claude',
      'netlify agents:create -p "Update README" -a codex -b feature-branch',
      'netlify agents:create "Triage this error" --attach error.log --attach screenshot.png',
    ])
    .action(async (prompt: string, options: OptionValues, command: BaseCommand) => {
      const { agentsCreate } = await import('./agents-create.js')
      await agentsCreate(prompt, options, command)
    })

  program
    .command('agents:list')
    .description('List agent runs for the current site')
    .option('-s, --status <status>', 'filter by status (running, done, error, archived)')
    .option('-b, --branch <branch>', 'filter by branch')
    .option('-u, --user <userId>', 'filter by user ID')
    .option('-t, --title <text>', 'filter by title (case-insensitive contains)')
    .option('--since <iso>', 'only show runs created on or after this ISO timestamp')
    .option('--until <iso>', 'only show runs created on or before this ISO timestamp')
    .option('--page <n>', 'page number (1-based)')
    .option('--per-page <n>', 'items per page (max 100)')
    .option('--account <slug>', 'list runs across an account instead of just this site')
    .option('--json', 'output result as JSON')
    .option('--ndjson', 'output one JSON object per line')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples([
      'netlify agents:list',
      'netlify agents:list --status running',
      'netlify agents:list --status archived',
      'netlify agents:list --branch main --since 2026-04-01',
      'netlify agents:list --account my-team',
      'netlify agents:list --ndjson',
    ])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { agentsList } = await import('./agents-list.js')
      await agentsList(options, command)
    })

  program
    .command('agents:show')
    .argument('<id>', 'agent run ID to show')
    .description('Show details of a specific agent run')
    .option('-w, --watch', 'poll until the run reaches a terminal state')
    .option('--session <sid>', 'show details of a specific session within the run')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples([
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a',
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --watch',
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --session 70d8...',
    ])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsShow } = await import('./agents-show.js')
      await agentsShow(id, options, command)
    })

  program
    .command('agents:stop')
    .argument('<id>', 'agent run ID to stop')
    .description('Stop a running agent run')
    .option('-y, --yes', 'skip confirmation prompt')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples(['netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a', 'netlify agents:stop 60c7c3b3e7b4a0001f5e4b3a --yes'])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsStop } = await import('./agents-stop.js')
      await agentsStop(id, options, command)
    })

  program
    .command('agents:open')
    .argument('<id>', 'agent run ID to open')
    .argument('[target]', 'what to open: preview (default), dashboard, or pr', 'preview')
    .description('Open the agent run preview, dashboard, or pull request in a browser')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples([
      'netlify agents:open 60c7c3b3e7b4a0001f5e4b3a',
      'netlify agents:open 60c7c3b3e7b4a0001f5e4b3a dashboard',
      'netlify agents:open 60c7c3b3e7b4a0001f5e4b3a pr',
    ])
    .action(async (id: string, target: string | undefined, options: OptionValues, command: BaseCommand) => {
      const { agentsOpen } = await import('./agents-open.js')
      await agentsOpen(id, target, options, command)
    })

  program
    .command('agents:diff')
    .argument('<id>', 'agent run ID')
    .description('Print the code changes produced by an agent run')
    .option('--page <n>', 'page number (1-based)')
    .option('--per-page <n>', 'files per page (max 100)')
    .option('--session <sid>', 'show a single session diff instead of the run aggregate')
    .option('--cumulative', 'with --session, show the cumulative diff up through that session')
    .option('--no-strip-binary', 'include raw binary content in the diff (binary is stripped by default)')
    .option('--no-color', 'disable color in the output')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples([
      'netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a',
      'netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --page 2',
      'netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --session 70d8... --cumulative',
      'netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a --no-color | less',
    ])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsDiff } = await import('./agents-diff.js')
      await agentsDiff(id, options, command)
    })

  program
    .command('agents:pr')
    .argument('<id>', 'agent run ID')
    .description('Open a pull request for an agent run')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples(['netlify agents:pr 60c7c3b3e7b4a0001f5e4b3a'])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsPullRequest } = await import('./agents-pr.js')
      await agentsPullRequest(id, options, command)
    })

  program
    .command('agents:commit')
    .argument('<id>', 'agent run ID')
    .description('Commit an agent run’s changes directly to a branch')
    .option('-b, --branch <branch>', 'target branch to commit to')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples(['netlify agents:commit 60c7c3b3e7b4a0001f5e4b3a --branch staging'])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsCommit } = await import('./agents-commit.js')
      await agentsCommit(id, options, command)
    })

  program
    .command('agents:redeploy')
    .argument('<id>', 'agent run ID')
    .description('Redeploy an agent run by reapplying its existing changes (no AI inference)')
    .option('--session <sid>', 'redeploy a specific session (defaults to the latest completed one)')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples([
      'netlify agents:redeploy 60c7c3b3e7b4a0001f5e4b3a',
      'netlify agents:redeploy 60c7c3b3e7b4a0001f5e4b3a --session 70d8...',
    ])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsRedeploy } = await import('./agents-redeploy.js')
      await agentsRedeploy(id, options, command)
    })

  program
    .command('agents:sync')
    .argument('<id>', 'agent run ID')
    .description('Bring an agent run up to date with the latest code from its base branch')
    .option('-y, --yes', 'skip confirmation prompt')
    .option('--json', 'output result as JSON')
    .option('--project <project>', 'project ID or name (if not in a linked directory)')
    .hook('preAction', requiresSiteInfoWithProject)
    .addExamples(['netlify agents:sync 60c7c3b3e7b4a0001f5e4b3a', 'netlify agents:sync 60c7c3b3e7b4a0001f5e4b3a --yes'])
    .action(async (id: string, options: OptionValues, command: BaseCommand) => {
      const { agentsSync } = await import('./agents-sync.js')
      await agentsSync(id, options, command)
    })

  const name = chalk.greenBright('`agents`')

  return program
    .command('agents')
    .description(
      `Manage Netlify AI agent runs
The ${name} command will help you run AI agents on your Netlify sites to automate development tasks

Note: Agent runs execute remotely on Netlify infrastructure, not locally.`,
    )
    .addExamples([
      'netlify agents:create --prompt "Add a contact form"',
      'netlify agents:list --status running',
      'netlify agents:show 60c7c3b3e7b4a0001f5e4b3a --watch',
      'netlify agents:diff 60c7c3b3e7b4a0001f5e4b3a',
      'netlify agents:open 60c7c3b3e7b4a0001f5e4b3a',
    ])
    .action(agents)
}
