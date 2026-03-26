import BaseCommand from '../base-command.js'

export const createGitCredentialsCommand = (program: BaseCommand) =>
  program
    .command('git-credentials', { hidden: true })
    .description('Git credential helper for Netlify-hosted repos')
    .action(async (_options, command: BaseCommand) => {
      const { gitCredentials } = await import('./git-credentials.js')
      await gitCredentials(command)
    })
