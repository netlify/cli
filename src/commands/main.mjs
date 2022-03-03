// @ts-check
import { readFileSync } from 'fs'
import { argv } from 'process'
import { fileURLToPath } from 'url'

import { Option } from 'commander'
import inquirer from 'inquirer'
import { findBestMatch } from 'string-similarity'

import utils from '../utils/index.js'

import { createAddonsCommand } from './addons/index.mjs'
import api from './api/index.js'
import { BaseCommand } from './base-command.mjs'
import build from './build/index.js'
import completion from './completion/index.js'
import deploy from './deploy/index.js'
import dev from './dev/index.js'
import env from './env/index.js'
import functions from './functions/index.js'
import graph from './graph/index.js'
import init from './init/index.js'
import link from './link/index.js'
import lm from './lm/index.js'
import login from './login/index.js'
import logout from './logout/index.js'
import open from './open/index.js'
import sites from './sites/index.js'
import status from './status/index.js'
import { createSwitchCommand } from './switch/index.mjs'
import unlink from './unlink/index.js'
import watch from './watch/index.js'

const { BANG, NETLIFY_CYAN, USER_AGENT, chalk, error, execa, exit, getGlobalConfig, log, track, warn } = utils

const { bugs } = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf-8'))

const SUGGESTION_TIMEOUT = 1e4

const getVersionPage = async () => {
  // performance optimization - load envinfo on demand
  const { run } = await import('envinfo')
  const data = await run({
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
 * @param {import('./base-command.mjs').BaseCommand} command
 */
export const mainCommand = async function (options, command) {
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
    const title = `${chalk.bgBlack.cyan('⬥ Netlify CLI')}`
    const docsMsg = `${chalk.greenBright('Read the docs:')} https://www.netlify.com/docs/cli`
    const supportMsg = `${chalk.magentaBright('Support and bugs:')} ${bugs.url}`

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

  await execa(argv[0], [argv[1], suggestion], { stdio: 'inherit' })
}

/**
 * Creates the `netlify-cli` command
 * Promise is needed as the envinfo is a promise
 * @returns {import('./base-command.mjs').BaseCommand}
 */
export const createMainCommand = () => {
  const program = new BaseCommand('netlify')
  // register all the commands
  createAddonsCommand(program)
  api.createApiCommand(program)
  build.createBuildCommand(program)
  completion.createCompletionCommand(program)
  deploy.createDeployCommand(program)
  dev.createDevCommand(program)
  env.createEnvCommand(program)
  functions.createFunctionsCommand(program)
  graph.createGraphCommand(program)
  init.createInitCommand(program)
  link.createLinkCommand(program)
  lm.createLmCommand(program)
  login.createLoginCommand(program)
  logout.createLogoutCommand(program)
  open.createOpenCommand(program)
  sites.createSitesCommand(program)
  status.createStatusCommand(program)
  createSwitchCommand(program)
  unlink.createUnlinkCommand(program)
  watch.createWatchCommand(program)

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
