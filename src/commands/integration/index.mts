import { env } from 'process'

import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

const integrations = (options: OptionValues, command: BaseCommand) => {
  command.help()
}

export const createIntegrationDeployCommand = (program: BaseCommand) => {
  program
    .command('integration:deploy')
    .alias('int:deploy')
    .description('Register, build, and deploy a private integration on Netlify')
    .option('-p, --prod', 'Deploy to production', false)
    .option('-b, --build', 'Build the integration', false)
    .option('-a, --auth <token>', 'Netlify auth token to deploy with', env.NETLIFY_AUTH_TOKEN)
    .option('-s, --site <name-or-id>', 'A site name or ID to deploy to', env.NETLIFY_SITE_ID)
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { deploy } = await import('./deploy.mjs')
      await deploy(options, command)
    })
}

export const createIntegrationCommand = (program: BaseCommand) => {
  createIntegrationDeployCommand(program)

  return program
    .command('integration')
    .alias('int')
    .description('Manage Netlify Integrations built with the Netlify SDK')
    .action(integrations)
}
