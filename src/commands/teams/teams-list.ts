import type { OptionValues } from 'commander'

import { chalk, log, logJson } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

export const teamsList = async (options: OptionValues, command: BaseCommand) => {
  await command.authenticate(options.auth as string)

  const { accounts } = command.netlify

  if (options.json) {
    logJson(
      accounts.map((account) => ({
        id: account.id,
        name: account.name,
        slug: account.slug,
        default: account.default,
        type_name: account.type_name,
        type_slug: account.type_slug,
        members_count: account.members_count,
      })),
    )
    return
  }

  if (accounts.length === 0) {
    log('No teams found.')
    return
  }

  log(`
────────────────────────────┐
 Your Netlify Teams         │
────────────────────────────┘

Count: ${String(accounts.length)}
`)

  accounts.forEach((account) => {
    const defaultLabel = account.default ? chalk.green(' (default)') : ''
    log(`${chalk.greenBright(account.name)}${defaultLabel}`)
    log(`  ${chalk.whiteBright.bold('slug:')}    ${chalk.yellowBright(account.slug)}`)
    log(`  ${chalk.whiteBright.bold('type:')}    ${chalk.white(account.type_name)}`)
    log(`  ${chalk.whiteBright.bold('members:')} ${chalk.white(String(account.members_count))}`)
    log(`─────────────────────────────────────────────────`)
  })
}
