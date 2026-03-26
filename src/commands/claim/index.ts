import BaseCommand from '../base-command.js'

export const createClaimCommand = (program: BaseCommand) =>
  program
    .command('claim')
    .description('Claim an anonymously deployed site and link it to your account')
    .argument('<siteId>', 'The site ID of the anonymous deploy to claim')
    .requiredOption('--token <token>', 'The drop token provided when the site was deployed')
    .addExamples(['netlify claim abc123 --token drop-jwt-token'])
    .action(async (siteId: string, options: { token: string }, command: BaseCommand) => {
      const { claim } = await import('./claim.js')
      await claim(siteId, options.token, command)
    })
