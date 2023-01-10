// @ts-check
import process from 'process'

import execa from 'execa'
import stripAnsiCc from 'strip-ansi-control-characters'

import { chalk, log, NETLIFYDEVERR, NETLIFYDEVWARN } from './command-helpers.mjs'
import { processOnExit } from './dev.mjs'

/**
 * @type {(() => Promise<void>)[]} - array of functions to run before the process exits
 */
const cleanupWork = []

let cleanupStarted = false

/**
 * @param {() => Promise<void>} job
 */
export const addCleanupJob = (job) => {
  cleanupWork.push(job)
}

/**
 * @param {object} input
 * @param {number=} input.exitCode The exit code to return when exiting the process after cleanup
 */
const cleanupBeforeExit = async ({ exitCode }) => {
  // If cleanup has started, then wherever started it will be responsible for exiting
  if (!cleanupStarted) {
    cleanupStarted = true
    try {
      await Promise.all(cleanupWork.map((cleanup) => cleanup()))
    } finally {
      process.exit(exitCode)
    }
  }
}

/**
 * Run a command and pipe stdout, stderr and stdin
 * @param {string} command
 * @param {NodeJS.ProcessEnv} env
 * @returns {execa.ExecaChildProcess<string>}
 */
export const runCommand = (command, env = {}, spinner = null) => {
  const commandProcess = execa.command(command, {
    preferLocal: true,
    // we use reject=false to avoid rejecting synchronously when the command doesn't exist
    reject: false,
    env,
    // windowsHide needs to be false for child process to terminate properly on Windows
    windowsHide: false,
  })

  // This ensures that an active spinner stays at the bottom of the commandline
  // even though the actual framework command might be outputting stuff
  const pipeDataWithSpinner = (writeStream, chunk) => {
    if (spinner && spinner.isSpinning) {
      spinner.clear()
      spinner.isSilent = true
    }
    writeStream.write(chunk, () => {
      if (spinner && spinner.isSpinning) {
        spinner.isSilent = false
        spinner.render()
      }
    })
  }

  commandProcess.stdout.pipe(stripAnsiCc.stream()).on('data', pipeDataWithSpinner.bind(null, process.stdout))
  commandProcess.stderr.pipe(stripAnsiCc.stream()).on('data', pipeDataWithSpinner.bind(null, process.stderr))
  process.stdin.pipe(commandProcess.stdin)

  // we can't try->await->catch since we don't want to block on the framework server which
  // is a long running process
  // eslint-disable-next-line promise/catch-or-return
  commandProcess
    // eslint-disable-next-line promise/prefer-await-to-then
    .then(async () => {
      const result = await commandProcess
      const [commandWithoutArgs] = command.split(' ')
      if (result.failed && isNonExistingCommandError({ command: commandWithoutArgs, error: result })) {
        log(
          NETLIFYDEVERR,
          `Failed running command: ${command}. Please verify ${chalk.magenta(`'${commandWithoutArgs}'`)} exists`,
        )
      } else {
        const errorMessage = result.failed
          ? `${NETLIFYDEVERR} ${result.shortMessage}`
          : `${NETLIFYDEVWARN} "${command}" exited with code ${result.exitCode}`

        log(`${errorMessage}. Shutting down Netlify Dev server`)
      }

      return await cleanupBeforeExit({ exitCode: 1 })
    })
  processOnExit(async () => await cleanupBeforeExit({}))

  return commandProcess
}

const isNonExistingCommandError = ({ command, error: commandError }) => {
  // `ENOENT` is only returned for non Windows systems
  // See https://github.com/sindresorhus/execa/pull/447
  if (commandError.code === 'ENOENT') {
    return true
  }

  // if the command is a package manager we let it report the error
  if (['yarn', 'npm'].includes(command)) {
    return false
  }

  // this only works on English versions of Windows
  return (
    typeof commandError.message === 'string' &&
    commandError.message.includes('is not recognized as an internal or external command')
  )
}
