import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.mjs'
import BaseCommand from '../base-command.mjs'
import { login } from '../login/login.mjs'

const LOGIN_NEW = 'I would like to login to a new account'

export const switchCommand = async (options: OptionValues, command: BaseCommand) => {
  const availableUsersChoices = Object.values(command.netlify.globalConfig.get('users') || {}).reduce(
    (prev, current) =>
      // @ts-expect-error TS(2769) FIXME: No overload matches this call.
      Object.assign(prev, { [current.id]: current.name ? `${current.name} (${current.email})` : current.email }),
    {},
  )

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
