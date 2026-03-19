import type { OptionValues } from 'commander'

import type BaseCommand from '../base-command.js'

export const createCreateCommand = (program: BaseCommand) => {
  program
    .command('create')
    .description('Create a new Netlify project using an AI agent')
    .argument('[prompt]', 'description of the site to create')
    .option('-p, --prompt <prompt>', 'description of the site to create')
    .option('--agent <agent>', 'agent type (claude, codex, gemini)')
    .option('-m, --model <model>', 'model to use for the agent')
    .option('-n, --name <name>', 'project name (subdomain)')
    .option('-d, --dir <path>', 'directory to create the project in (defaults to current directory)')
    .option('-a, --account-slug <slug>', 'account slug to create the project under')
    .option('--no-download', 'skip downloading source code after the agent run completes')
    .option('--no-wait', 'return immediately after starting the agent run without polling for completion')
    .option('--json', 'output result as JSON')
    .addExamples([
      'netlify create "a portfolio site"',
      'netlify create --prompt "a blog with dark mode" --agent claude',
      'netlify create "landing page for a coffee shop" --account-slug my-team',
      'netlify create "an e-commerce store" --name my-store',
      'netlify create "an e-commerce store" --no-wait',
    ])
    .action(async (prompt: string, options: OptionValues, command: BaseCommand) => {
      const { createAction } = await import('./create-action.js')
      await createAction(prompt, options, command)
    })
}
