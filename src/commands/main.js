// @ts-check
const process = require('process')

const inquirer = require('inquirer')
const { findBestMatch } = require('string-similarity')

const { NETLIFY_CYAN, USER_AGENT, chalk, error, execa, exit, getGlobalConfig, log, track, warn } = require('../utils')

const SUGGESTION_TIMEOUT = 1e4

const getVersionPage = async () => {
  // performance optimization - load envinfo on demand
  // eslint-disable-next-line node/global-require
  const envinfo = require('envinfo')
  const data = await envinfo.run({
    System: ['OS', 'CPU'],
    Binaries: ['Node', 'Yarn', 'npm'],
    Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
    npmGlobalPackages: ['netlify-cli'],
  })

  return `
────────────────────┐
 Environment Info   │
────────────────────┘
${data}
${USER_AGENT}
`
}

/**
 * The main CLI command without any command (root action)
 * @param {import('commander').OptionValues} options
 * @param {import('./base-command').BaseCommand} command
 */
const mainCommand = async function (options, command) {
  const globalConfig = await getGlobalConfig()

  if (options.telemetryDisable) {
    globalConfig.set('telemetryDisabled', true)
    console.log('Netlify telemetry has been disabled')
    console.log('You can renable it anytime with the --telemetry-enable flag')
    exit()
  }
  if (options.telemetryEnable) {
    globalConfig.set('telemetryDisabled', false)
    console.log('Netlify telemetry has been enabled')
    console.log('You can disable it anytime with the --telemetry-disable flag')
    await track('user_telemetryEnabled')
    exit()
  }

  if (command.args[0] === 'version') {
    const versionPage = await getVersionPage()
    log(versionPage)
    exit()
  }

  if (command.args[0] === 'help') {
    command.help();
  }

  warn(`${chalk.yellow(command.args[0])} is not a ${command.name()} command.`)

  const allCommands = command.commands.map((cmd) => cmd.name())
  const {
    bestMatch: { target: suggestion },
  } = findBestMatch(command.args[0], allCommands)

  const applySuggestion = await new Promise((resolve) => {
    const prompt = inquirer.prompt({
      type: 'confirm',
      name: 'suggestion',
      message: `Did you mean ${chalk.blue(suggestion)}`,
      default: false,
    })

    setTimeout(() => {
      // @ts-ignore
      prompt.ui.close()
      resolve(false)
    }, SUGGESTION_TIMEOUT)

    // eslint-disable-next-line promise/catch-or-return
    prompt.then((value) => resolve(value))
  })
  // create new log line
  log()

  if (!applySuggestion) {
    error(`Run ${NETLIFY_CYAN(`${command.name()} help`)} for a list of available commands.`)
  }

  await execa(process.argv[0], [process.argv[1], suggestion], { stdio: 'inherit' })
}

/**
 * Creates the `netlify functions:create` command
 * @param {import('./base-command').BaseCommand} program
 * @returns
 */
const createMainCommand = async (program) =>
  program
    .version(await getVersionPage(), '-v, --version')
    .showSuggestionAfterError(true)
    .option('--telemetry-disable', 'Disable telemetry')
    .option('--telemetry-enable', 'Enables telemetry')
    .configureHelp({
      // TODO: Add custom formater to have same visual styling
      //   formatHelp: (cmd, helper) => {
      //     console.log(cmd, helper);
      //     const longestFlag = Math.max(...cmd.options.map((option) => option.flags.length)) + 1;
      //     const table = cmd.options.map(({flags, description}) => `  ${flags}${new Array(longestFlag-flags.length).fill().join(' ')}   {grey ${description}} `).join('\n')
      //     return chalk`{bold OPTIONS}
      // ${table}
      // `
      //   }
    })
    .action(mainCommand)

module.exports = { createMainCommand }
