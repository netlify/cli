import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

export const createLoginCommand = (program: BaseCommand) =>
  program
    .command('login')
    .description(
      `Login to your Netlify account
Opens a web browser to acquire an OAuth token.`,
    )
    .option('--new', 'Login to new Netlify account')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { login } = await import('./login.mjs')
      await login(options, command)
    })
