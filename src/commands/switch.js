const Command = require('../utils/command')
const chalk = require('chalk')
const inquirer = require('inquirer')
const LoginCommand = require('./login')

class SwitchCommand extends Command {
  async run() {
    const LOGIN_NEW = 'I would like to login to a new account'
    const availableUsersChoices = Object.values(this.netlify.globalConfig.get('users')).reduce(
      (prev, current) =>
        Object.assign(prev, { [current.id]: current.name ? `${current.name} (${current.email})` : current.email }),
      {}
    )

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'switch'
      }
    })

    const { accountSwitchChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'accountSwitchChoice',
        message: 'Please select the account you want to use:',
        choices: [...Object.entries(availableUsersChoices).map(([, val]) => val), LOGIN_NEW]
      }
    ])

    if (accountSwitchChoice === LOGIN_NEW) {
      await LoginCommand.run(['--new'])
    } else {
      const selectedAccount = Object.entries(availableUsersChoices).find(([k, v]) => v === accountSwitchChoice)
      this.netlify.globalConfig.set('userId', selectedAccount[0])
      this.log('')
      this.log(`You're now using ${chalk.bold(selectedAccount[1])}.`)
    }

    return this.exit()
  }
}

SwitchCommand.description = `Switch your active Netlify account`

module.exports = SwitchCommand
