import { env } from 'process'

/**
 * Creates the `netlify int deploy` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */

export const createDeployCommand = (program) =>
  program
    .command('integration:deploy')
    .alias('int:deploy')
    .description('Register, build, and deploy a private integration on Netlify')
    .option('-p, --prod', 'Deploy to production', false)
    .option('-b, --build', 'Build the integration', false)
    .option('-a, --auth <token>', 'Netlify auth token to deploy with', env.NETLIFY_AUTH_TOKEN)
    .option('-s, --site <name-or-id>', 'A site name or ID to deploy to', env.NETLIFY_SITE_ID)
    .action(async (options, command) => {
      const { deploy } = await import('./deploy.mjs')
      await deploy(options, command)
    })
