import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { login } from '../login/login.js'

const LOGIN_NEW = 'I would like to login to a new account'

export const switchCommand = async (options: OptionValues, command: BaseCommand) => {
  const users = (command.netlify.globalConfig.get('users') || {}) as Record<
    string,
    { id: string; name?: string; email: string }
  >
  const availableUsersChoices = Object.values(users).reduce<Record<string, string>>(
    (prev, current) =>
      Object.assign(prev, { [current.id]: current.name ? `${current.name} (${current.email})` : current.email }),
    {},
  )

  if (options.email) {
    const matchedUser = Object.values(users).find((user) => user.email === options.email)
    if (matchedUser) {
      command.netlify.globalConfig.set('userId', matchedUser.id)
      log('')
      log(`You're now using ${chalk.bold(availableUsersChoices[matchedUser.id])}.`)
      return
    }
    log(`No account found matching ${chalk.bold(options.email)}, showing all available accounts.`)
    log('')
  }

  const { accountSwitchChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'accountSwitchChoice',
      message: 'Please select the account you want to use:',
      // @ts-expect-error TS(2769) FIXME: No overload matches this call.
      choices: [...Object.entries(availableUsersChoices).map(([, val]) => val), LOGIN_NEW],
    },
  ])

  if (accountSwitchChoice === LOGIN_NEW) {
    await login({ new: true }, command)
  } else {
    // @ts-expect-error TS(2769) FIXME: No overload matches this call.
    const selectedAccount = Object.entries(availableUsersChoices).find(
      ([, availableUsersChoice]) => availableUsersChoice === accountSwitchChoice,
    )
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    command.netlify.globalConfig.set('userId', selectedAccount[0])
    log('')
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    log(`You're now using ${chalk.bold(selectedAccount[1])}.`)
  }
}
