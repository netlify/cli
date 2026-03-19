import type { OptionValues } from 'commander'

import type BaseCommand from '../base-command.js'

export const createCreateCommand = (program: BaseCommand) => {
  program
    .command('create')
    .description('Create a new Netlify project using an AI agent')
    .argument('[prompt]', 'description of the site to create')
    .option('-p, --prompt <prompt>', 'description of the site to create')
    .option('-a, --agent <agent>', 'agent type (claude, codex, gemini)')
    .option('-m, --model <model>', 'model to use for the agent')
    .option('--account <slug>', 'account slug to create the site in')
    .option('--json', 'output result as JSON')
    .addExamples([
      'netlify create "a portfolio site"',
      'netlify create --prompt "a blog with dark mode" --agent claude',
      'netlify create "landing page for a coffee shop" --account my-team',
    ])
    .action(async (prompt: string, options: OptionValues, command: BaseCommand) => {
      const { createAction } = await import('./create-action.js')
      await createAction(prompt, options, command)
    })
}
