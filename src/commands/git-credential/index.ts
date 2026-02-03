import type BaseCommand from '../base-command.js'
import type { GitCredentialOptionValues } from './option_values.js'

export const createGitCredentialCommand = (program: BaseCommand) =>
  program
    .command('git-credential', { hidden: true })
    .description('Git credential helper for Netlify authentication (used internally by git)')
    .argument('<operation>', 'Git credential operation (get, store, erase)')
    .action(async (operation: string, options: GitCredentialOptionValues, command: BaseCommand) => {
      const { gitCredential } = await import('./git-credential.js')
      await gitCredential(operation, options, command)
    })
