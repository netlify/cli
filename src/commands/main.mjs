// @ts-check
import process from 'process'

import { Option } from 'commander'
import inquirer from 'inquirer'
import { findBestMatch } from 'string-similarity'

import { BANG, chalk, error, exit, log, NETLIFY_CYAN, USER_AGENT, warn } from '../utils/command-helpers.mjs'
import execa from '../utils/execa.mjs'
import getGlobalConfig from '../utils/get-global-config.mjs'
import getPackageJson from '../utils/get-package-json.mjs'
import { track } from '../utils/telemetry/index.mjs'

import { createAddonsCommand } from './addons/index.mjs'
import { createApiCommand } from './api/index.mjs'
import BaseCommand from './base-command.mjs'
import { createBuildCommand } from './build/index.mjs'
import { createCompletionCommand } from './completion/index.mjs'
import { createDeployCommand } from './deploy/index.mjs'
import { createDevCommand } from './dev/index.mjs'
import { createEnvCommand } from './env/index.mjs'
import { createFunctionsCommand } from './functions/index.mjs'
import { createInitCommand } from './init/index.mjs'
import { createLinkCommand } from './link/index.mjs'
import { createLmCommand } from './lm/index.mjs'
import { createLoginCommand } from './login/index.mjs'
import { createLogoutCommand } from './logout/index.mjs'
import { createOpenCommand } from './open/index.mjs'
import { createRecipesCommand } from './recipes/index.mjs'
import { createServeCommand } from './serve/serve.mjs'
import { createSitesCommand } from './sites/index.mjs'
import { createStatusCommand } from './status/index.mjs'
import { createSwitchCommand } from './switch/index.mjs'
import { createUnlinkCommand } from './unlink/index.mjs'
import { createWatchCommand } from './watch/index.mjs'

const SUGGESTION_TIMEOUT = 1e4

const getVersionPage = async () => {
  // performance optimization - load envinfo on demand

  const envinfo = await import('envinfo')
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
 * @param {import('./base-command.mjs').default} command
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

  if (command.args[0] === 'version' || options.version) {
    if (options.verbose) {
      const versionPage = await getVersionPage()
      log(versionPage)
    }
    log(USER_AGENT)
    exit()
  }

  // if no command show the header and the help
  if (command.args.length === 0) {
    const pkg = await getPackageJson()

    const title = `${chalk.bgBlack.cyan('⬥ Netlify CLI')}`
    const docsMsg = `${chalk.greenBright('Read the docs:')} https://docs.netlify.com/cli/get-started/`
    const supportMsg = `${chalk.magentaBright('Support and bugs:')} ${pkg.bugs.url}`

    console.log()
    console.log(title)
    console.log(docsMsg)
    console.log(supportMsg)
    console.log()

    command.help()
  }

  if (command.args[0] === 'help') {
    if (command.args[1]) {
      const subCommand = command.commands.find((cmd) => cmd.name() === command.args[1])
      if (!subCommand) {
        error(`command ${command.args[1]} not found`)
      }
      subCommand.help()
    }
    command.help()
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
    prompt.then((value) => resolve(value.suggestion))
  })
  // create new log line
  log()

  if (!applySuggestion) {
    error(`Run ${NETLIFY_CYAN(`${command.name()} help`)} for a list of available commands.`)
  }

  await execa(process.argv[0], [process.argv[1], suggestion], { stdio: 'inherit' })
}

/**
 * Creates the `netlify-cli` command
 * Promise is needed as the envinfo is a promise
 * @returns {import('./base-command.mjs').default}
 */
export const createMainCommand = () => {
  const program = new BaseCommand('netlify')
  // register all the commands
  createAddonsCommand(program)
  createApiCommand(program)
  createBuildCommand(program)
  createCompletionCommand(program)
  createDeployCommand(program)
  createDevCommand(program)
  createEnvCommand(program)
  createFunctionsCommand(program)
  createRecipesCommand(program)
  createInitCommand(program)
  createLinkCommand(program)
  createLmCommand(program)
  createLoginCommand(program)
  createLogoutCommand(program)
  createOpenCommand(program)
  createServeCommand(program)
  createSitesCommand(program)
  createStatusCommand(program)
  createSwitchCommand(program)
  createUnlinkCommand(program)
  createWatchCommand(program)

  program
    .version(USER_AGENT, '-V')
    .showSuggestionAfterError(true)
    .option('--telemetry-disable', 'Disable telemetry')
    .option('--telemetry-enable', 'Enables telemetry')
    // needed for custom version output as we display further environment information
    // commanders version output is set to uppercase -V
    .addOption(new Option('-v, --version').hideHelp())
    .addOption(new Option('--verbose').hideHelp())
    .noHelpOptions()
    .configureOutput({
      outputError: (message, write) => {
        write(` ${chalk.red(BANG)}   Error: ${message.replace(/^error:\s/g, '')}`)
        write(` ${chalk.red(BANG)}   See more help with --help\n`)
      },
    })
    .action(mainCommand)

  return program
}
