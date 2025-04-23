import { OptionValues } from 'commander'
import inquirer from 'inquirer'

import { chalk, log } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { login } from '../login/login.js'

const LOGIN_NEW = 'I would like to login to a new account'

export const switchCommand = async (_options: OptionValues, command: BaseCommand) => {
  const availableUsersChoices = Object.values(command.netlify.globalConfig.get('users')).map((user) => ({
    name: user.name ? `${user.name} (${user.email})` : user.email,
    value: user.id,
  }))

  const { accountSwitchChoice } = await inquirer.prompt<{ accountSwitchChoice: string }>([
    {
      type: 'list',
      name: 'accountSwitchChoice',
      message: 'Please select the account you want to use:',
      choices: [availableUsersChoices, { name: LOGIN_NEW, value: 'LOGIN_NEW' }],
    },
  ])

  if (accountSwitchChoice === 'LOGIN_NEW') {
    await login({ new: true }, command)
  } else {
    command.netlify.globalConfig.set('userId', accountSwitchChoice)
    log('')
    const chosenUser =
      availableUsersChoices.find(({ value }) => value === accountSwitchChoice)?.value ?? accountSwitchChoice
    log(`You're now using ${chalk.bold(chosenUser)}.`)
  }
}
