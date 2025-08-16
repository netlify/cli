import { OptionValues } from 'commander'

import { startSpinner } from '../../lib/spinner.js'
import { chalk, log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

export const teamsList = async (options: OptionValues, command: BaseCommand) => {
  let spinner
  if (!options.json) {
    spinner = startSpinner({ text: 'Loading your teams' })
  }
  
  await command.authenticate()

  const { accounts } = command.netlify
  
  if (spinner) {
    spinner.success()
  }

  if (accounts.length !== 0) {
    // Json response for piping commands
    if (options.json) {
      logJson(accounts)
      return false
    }

    log(`
────────────────────────────┐
 Current Netlify Teams     │
────────────────────────────┘

Count: ${accounts.length.toString()}
`)

    accounts.forEach((account) => {
      log(`${chalk.greenBright(account.name)} - ${chalk.cyan(account.slug)}`)
      log(`  ${chalk.whiteBright.bold('id:')} ${chalk.white(account.id)}`)
      if (account.default) {
        log(`  ${chalk.whiteBright.bold('default:')} ${chalk.green('Yes')}`)
      }
      log(`─────────────────────────────────────────────────`)
    })
  } else {
    log('No teams found.')
  }
}