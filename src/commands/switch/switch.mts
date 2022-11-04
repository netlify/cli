// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'inquirer'.
const inquirer = require('inquirer')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, log } = require('../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'login'.
const { login } = require('../login/index.cjs')

const LOGIN_NEW = 'I would like to login to a new account'

/**
 * The switch command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const switchCommand = async (options: $TSFixMe, command: $TSFixMe) => {
  // @ts-expect-error TS(2769): No overload matches this call.
  const availableUsersChoices = Object.values(command.netlify.globalConfig.get('users') || {}).reduce((prev, current) => Object.assign(prev, { [(current as $TSFixMe).id]: (current as $TSFixMe).name ? `${(current as $TSFixMe).name} (${(current as $TSFixMe).email})` : (current as $TSFixMe).email }), {});

  const { accountSwitchChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'accountSwitchChoice',
      message: 'Please select the account you want to use:',
      // @ts-expect-error TS(2769): No overload matches this call.
      choices: [...Object.entries(availableUsersChoices).map(([, val]) => val), LOGIN_NEW],
    },
  ])

  if (accountSwitchChoice === LOGIN_NEW) {
    await login({ new: true }, command)
  } else {
    // @ts-expect-error TS(2769): No overload matches this call.
    const selectedAccount = Object.entries(availableUsersChoices).find(
      ([, availableUsersChoice]) => availableUsersChoice === accountSwitchChoice,
    )
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    command.netlify.globalConfig.set('userId', selectedAccount[0])
    log('')
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    log(`You're now using ${chalk.bold(selectedAccount[1])}.`)
  }
}

/**
 * Creates the `netlify switch` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSwit... Remove this comment to see the full error message
const createSwitchCommand = (program: $TSFixMe) => program.command('switch').description('Switch your active Netlify account').action(switchCommand)

module.exports = { createSwitchCommand }
