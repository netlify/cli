import process from 'process'

import { Option } from 'commander'
import envinfo from 'envinfo'
import { closest } from 'fastest-levenshtein'
import inquirer from 'inquirer'

import { getGlobalConfigStore } from '@netlify/dev-utils'

import {
  BANG,
  chalk,
  logAndThrowError,
  exit,
  log,
  NETLIFY_CYAN,
  USER_AGENT,
  warn,
  logError,
} from '../utils/command-helpers.js'
import execa from '../utils/execa.js'
import getCLIPackageJson from '../utils/get-cli-package-json.js'
import { didEnableCompileCache } from '../utils/nodejs-compile-cache.js'
import { track, reportError } from '../utils/telemetry/index.js'

import { createApiCommand } from './api/index.js'
import BaseCommand from './base-command.js'
import { createBlobsCommand } from './blobs/blobs.js'
import { createBuildCommand } from './build/index.js'
import { createCloneCommand } from './clone/index.js'
import { createCompletionCommand } from './completion/index.js'
import { createDeployCommand } from './deploy/index.js'
import { createDevCommand } from './dev/index.js'
import { createDevExecCommand } from './dev-exec/index.js'
import { createEnvCommand } from './env/index.js'
import { createFunctionsCommand } from './functions/index.js'
import { createInitCommand } from './init/index.js'
import { createLinkCommand } from './link/index.js'
import { createLoginCommand } from './login/index.js'
import { createLogoutCommand } from './logout/index.js'
import { createLogsCommand } from './logs/index.js'
import { createOpenCommand } from './open/index.js'
import { createRecipesCommand } from './recipes/index.js'
import { createServeCommand } from './serve/index.js'
import { createSitesCommand } from './sites/index.js'
import { createStatusCommand } from './status/index.js'
import { createSwitchCommand } from './switch/index.js'
import { AddressInUseError } from './types.js'
import { createUnlinkCommand } from './unlink/index.js'
import { createWatchCommand } from './watch/index.js'
import terminalLink from 'terminal-link'
import { createDatabaseCommand } from './database/index.js'

const SUGGESTION_TIMEOUT = 1e4

// These commands run with the --force flag in non-interactive and CI environments
export const CI_FORCED_COMMANDS = {
  'env:set': { options: '--force', description: 'Bypasses prompts & Force the command to run.' },
  'env:unset': { options: '--force', description: 'Bypasses prompts & Force the command to run.' },
  'env:clone': { options: '--force', description: 'Bypasses prompts & Force the command to run.' },
  'blobs:set': { options: '--force', description: 'Bypasses prompts & Force the command to run.' },
  'blobs:delete': { options: '--force', description: 'Bypasses prompts & Force the command to run.' },
  init: {
    options: '--force',
    description: 'Reinitialize CI hooks if the linked project is already configured to use CI',
  },
  'sites:delete': { options: '-f, --force', description: 'Delete without prompting (useful for CI).' },
}

process.on('uncaughtException', async (err: AddressInUseError | Error) => {
  if ('code' in err && err.code === 'EADDRINUSE') {
    logError(
      `${chalk.red(`Port ${err.port} is already in use`)}\n\n` +
        `Your serverless functions might be initializing a server\n` +
        `to listen on specific port without properly closing it.\n\n` +
        `This behavior is generally not advised\n` +
        `To resolve this issue, try the following:\n` +
        `1. If you NEED your serverless function to listen on a specific port,\n` +
        `use a randomly assigned port as we do not officially support this.\n` +
        `2. Review your serverless functions for lingering server connections, close them\n` +
        `3. Check if any other applications are using port ${err.port}\n`,
    )
  } else {
    logError(
      `${chalk.red(
        'Netlify CLI has terminated unexpectedly',
      )}\nThis is a problem with the Netlify CLI, not with your application.\nIf you recently updated the CLI, consider reverting to an older version by running:\n\n${chalk.bold(
        'npm install -g netlify-cli@VERSION',
      )}\n\nYou can use any version from ${chalk.underline(
        'https://ntl.fyi/cli-versions',
      )}.\n\nPlease report this problem at ${chalk.underline(
        'https://ntl.fyi/cli-error',
      )} including the error details below.\n`,
    )

    const systemInfo = await getSystemInfo()

    console.log(chalk.dim(err.stack || err))
    console.log(chalk.dim(systemInfo))
    reportError(err, { severity: 'error' })
  }

  process.exit(1)
})

const pkg = await getCLIPackageJson()

const getSystemInfo = () =>
  envinfo.run({
    System: ['OS', 'CPU'],
    Binaries: ['Node', 'Yarn', 'npm'],
    Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
    npmGlobalPackages: ['netlify-cli'],
  })

const getVersionPage = async () => {
  const data = await getSystemInfo()

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
 * @param {import('./base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const mainCommand = async function (options, command) {
  const globalConfig = await getGlobalConfigStore()

  if (options.telemetryDisable) {
    globalConfig.set('telemetryDisabled', true)
    console.log('Netlify telemetry has been disabled')
    console.log('You can re-enable it anytime with the --telemetry-enable flag')
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

  // if no command show help
  if (command.args.length === 0) {
    command.help()
  }

  if (command.args[0] === 'help') {
    if (command.args[1]) {
      // @ts-expect-error TS(7006) FIXME: Parameter 'cmd' implicitly has an 'any' type.
      const subCommand = command.commands.find((cmd) => cmd.name() === command.args[1])
      if (!subCommand) {
        return logAndThrowError(`command ${command.args[1]} not found`)
      }
      subCommand.help()
    }
    command.help()
  }

  warn(`${chalk.yellow(command.args[0])} is not a ${command.name()} command.`)

  // @ts-expect-error TS(7006) FIXME: Parameter 'cmd' implicitly has an 'any' type.
  const allCommands = command.commands.map((cmd) => cmd.name())
  const suggestion = closest(command.args[0], allCommands)

  const applySuggestion = await new Promise((resolve) => {
    const prompt = inquirer.prompt({
      type: 'confirm',
      name: 'suggestion',
      message: `Did you mean ${chalk.blue(suggestion)}`,
      default: false,
    })

    setTimeout(() => {
      // @ts-expect-error TS(2445) FIXME: Property 'close' is protected and only accessible ... Remove this comment to see the full error message
      prompt.ui.close()
      resolve(false)
    }, SUGGESTION_TIMEOUT)

    prompt.then((value) => {
      resolve(value.suggestion)
    })
  })
  // create new log line
  log()

  if (!applySuggestion) {
    return logAndThrowError(`Run ${NETLIFY_CYAN(`${command.name()} help`)} for a list of available commands.`)
  }

  await execa(process.argv[0], [process.argv[1], suggestion], { stdio: 'inherit' })
}

/**
 * Creates the `netlify-cli` command
 */
export const createMainCommand = (): BaseCommand => {
  const program = new BaseCommand('netlify')

  // register all the commands
  createApiCommand(program)
  createBlobsCommand(program)
  createBuildCommand(program)
  createCompletionCommand(program)
  createDeployCommand(program)
  createDevExecCommand(program)
  createDevCommand(program)
  createEnvCommand(program)
  createFunctionsCommand(program)
  createRecipesCommand(program)
  createInitCommand(program)
  createCloneCommand(program)
  createLinkCommand(program)
  createLoginCommand(program)
  createLogoutCommand(program)
  createOpenCommand(program)
  createServeCommand(program)
  createSitesCommand(program)
  createStatusCommand(program)
  createSwitchCommand(program)
  createUnlinkCommand(program)
  createWatchCommand(program)
  createLogsCommand(program)
  createDatabaseCommand(program)

  program.setAnalyticsPayload({ didEnableCompileCache })

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
    .addHelpText('before', () => NETLIFY_CYAN('\n⬥ Netlify CLI\n'))
    .addHelpText('after', () => {
      const cliDocsEntrypointUrl = 'https://developers.netlify.com/cli'
      const docsUrl = 'https://docs.netlify.com'
      const bugsUrl = pkg.bugs?.url ?? ''
      return `→ For more help with the CLI, visit ${NETLIFY_CYAN(
        terminalLink(cliDocsEntrypointUrl, cliDocsEntrypointUrl, { fallback: false }),
      )}
→ For help with Netlify, visit ${NETLIFY_CYAN(terminalLink(docsUrl, docsUrl, { fallback: false }))}
→ To report a CLI bug, visit ${NETLIFY_CYAN(terminalLink(bugsUrl, bugsUrl, { fallback: false }))}\n`
    })
    .configureOutput({
      outputError: (message, write) => {
        write(` ${chalk.red(BANG)}   Error: ${message.replace(/^error:\s/g, '')}`)
        write(` ${chalk.red(BANG)}   See more help with --help\n`)
      },
    })
    .action(mainCommand)

  program.commands.forEach((cmd) => {
    const cmdName = cmd.name()
    if (cmdName in CI_FORCED_COMMANDS) {
      const { description, options } = CI_FORCED_COMMANDS[cmdName as keyof typeof CI_FORCED_COMMANDS]
      cmd.option(options, description)
    }
  })

  return program
}
