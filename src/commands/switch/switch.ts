import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'
import type { BaseOptionValues } from '../base-command.js'
import { login } from '../login/login.js'

const LOGIN_NEW = 'I would like to login to a new account'

export type SwitchOptionValues = BaseOptionValues & {
  email?: string | undefined
}

interface StoredUser {
  id: string
  name?: string
  email: string
}

const formatUser = ({ email, name }: StoredUser) => (name ? `${name} (${email})` : email)

export const switchCommand = async (options: SwitchOptionValues, command: BaseCommand) => {
  // FIXME(@netlify/dev-utils): `GlobalConfigStore` values are untyped
  const users = Object.values((command.netlify.globalConfig.get('users') || {}) as Record<string, StoredUser>)

  if (options.email) {
    const matchedUser = users.find((user) => user.email === options.email)
    if (matchedUser) {
      command.netlify.globalConfig.set('userId', matchedUser.id)
      log('')
      log(`You're now using ${chalk.bold(formatUser(matchedUser))}.`)
      return
    }
    log(`No account found matching ${chalk.bold(options.email)}, showing all available accounts.`)
    log('')
  }

  const { accountSwitchChoice } = await inquirer.prompt<{ accountSwitchChoice: StoredUser | typeof LOGIN_NEW }>([
    {
      type: 'list',
      name: 'accountSwitchChoice',
      message: 'Please select the account you want to use:',
      choices: [...users.map((user) => ({ name: formatUser(user), value: user })), LOGIN_NEW],
    },
  ])

  if (accountSwitchChoice === LOGIN_NEW) {
    await login({ new: true }, command)
  } else {
    command.netlify.globalConfig.set('userId', accountSwitchChoice.id)
    log('')
    log(`You're now using ${chalk.bold(formatUser(accountSwitchChoice))}.`)
  }
}
