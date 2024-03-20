import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { login } from '../login/login.js'
import { NetlifyLog, SelectOptions, intro, outro, select } from '../../utils/styles/index.js'

const LOGIN_NEW = 'I would like to login to a new account'

type User = { id: string; name: string; email: string }
type UserMap = { [key: string]: User }
export const switchCommand = async (_: OptionValues, command: BaseCommand) => {
  intro('switch')
  const users = (command.netlify.globalConfig.get('users') as UserMap | undefined) || {}
  const availableUsersChoices = Object.values(users).reduce<Record<string, string>>(
    (prev, current) =>
      Object.assign(prev, {
        [current.id]: current.name ? `${current.name} (${current.email})` : (current.email as string),
      }),
    {},
  )
  const accountSelectOptions: SelectOptions<string> = {
    options: [
      ...Object.entries(availableUsersChoices).map(([, val]) => ({ label: val, value: val })),
      { label: LOGIN_NEW, value: LOGIN_NEW },
    ],
    message: 'Please select the account you want to use:',
  }
  const accountSwitchChoice = await select(accountSelectOptions)

  if (accountSwitchChoice === LOGIN_NEW) {
    await login({ new: true }, command)
  } else {
    const selectedAccount = Object.entries(availableUsersChoices).find(
      ([, availableUsersChoice]) => availableUsersChoice === accountSwitchChoice,
    )
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    command.netlify.globalConfig.set('userId', selectedAccount[0])
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    outro({ exit: true, message: `You're now using ${chalk.bold(selectedAccount[1])}.` })
  }

  outro({ exit: true })
}
