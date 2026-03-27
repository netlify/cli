import BaseCommand from '../base-command.js'

export const createClaimCommand = (program: BaseCommand) =>
  program
    .command('claim')
    .description('Claim an anonymously deployed site and link it to your account')
    .requiredOption('-s, --site <siteId>', 'The site ID of the anonymous deploy to claim (required)')
    .requiredOption('--token <token>', 'The drop token provided when the site was deployed (required)')
    .addExamples(['netlify claim --site abc123 --token drop-jwt-token'])
    .action(async (options: { site: string; token: string }, command: BaseCommand) => {
      const { claim } = await import('./claim.js')
      await claim(options.site, options.token, command)
    })
