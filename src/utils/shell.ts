import process from 'process'
import { Transform } from 'stream'
import { stripVTControlCharacters } from 'util'

import execa from 'execa'

import { stopSpinner, type Spinner } from '../lib/spinner.js'

import { chalk, log, NETLIFYDEVERR, NETLIFYDEVWARN } from './command-helpers.js'
import { processOnExit } from './dev.js'

const isErrnoException = (value: unknown): value is NodeJS.ErrnoException =>
  value instanceof Error && Object.hasOwn(value, 'code')

const createStripAnsiControlCharsStream = (): Transform => new Transform({
  transform(chunk, _encoding, callback) {
    const text = typeof chunk === 'string' ? chunk : chunk.toString()
    callback(null, stripVTControlCharacters(text))
  }
})

const cleanupWork: (() => Promise<void>)[] = []

let cleanupStarted = false

/**
 * @param {object} input
 * @param {number=} input.exitCode The exit code to return when exiting the process after cleanup
 */
const cleanupBeforeExit = async ({ exitCode }: { exitCode?: number | undefined } = {}) => {
  // If cleanup has started, then wherever started it will be responsible for exiting
  if (!cleanupStarted) {
    cleanupStarted = true
    try {
      // @ts-expect-error TS(7005) FIXME: Variable 'cleanupWork' implicitly has an 'any[]' t... Remove this comment to see the full error message
      await Promise.all(cleanupWork.map((cleanup) => cleanup()))
    } finally {
      process.exit(exitCode)
    }
  }
}

export const runCommand = (
  command: string,
  options: {
    spinner?: Spinner
    env?: NodeJS.ProcessEnv
    cwd: string
  },
) => {
  const { cwd, env = {}, spinner } = options
  const commandProcess = execa.command(command, {
    preferLocal: true,
    // we use reject=false to avoid rejecting synchronously when the command doesn't exist
    reject: false,
    env: {
      // we want always colorful terminal outputs
      FORCE_COLOR: 'true',
      ...env,
    },
    // windowsHide needs to be false for child process to terminate properly on Windows
    windowsHide: false,
    cwd,
  })

  // Ensure that an active spinner stays at the bottom of the commandline
  // even though the actual framework command might be outputting stuff
  if (spinner?.isSpinning) {
    // The spinner is initially "started" in the usual sense (rendering frames on an interval).
    // In this case, we want to manually control when to clear and when to render a frame, so we turn this off.
    stopSpinner({ error: false, spinner })
  }
  const pipeDataWithSpinner = (writeStream: NodeJS.WriteStream, chunk: any) => {
    if (spinner?.isSpinning) {
      spinner.clear()
    }
    writeStream.write(chunk, () => {
      spinner?.spin()
    })
  }

  commandProcess.stdout?.pipe(createStripAnsiControlCharsStream()).on('data', pipeDataWithSpinner.bind(null, process.stdout))
  commandProcess.stderr?.pipe(createStripAnsiControlCharsStream()).on('data', pipeDataWithSpinner.bind(null, process.stderr))
  if (commandProcess.stdin != null) {
    process.stdin?.pipe(commandProcess.stdin)
  }

  // we can't try->await->catch since we don't want to block on the framework server which
  // is a long running process
  commandProcess.then(async () => {
    const result = await commandProcess
    const [commandWithoutArgs] = command.split(' ')
    if (result.failed && isNonExistingCommandError({ command: commandWithoutArgs, error: result })) {
      log(
        `${NETLIFYDEVERR} Failed running command: ${command}. Please verify ${chalk.magenta(
          `'${commandWithoutArgs}'`,
        )} exists`,
      )
    } else {
      const errorMessage = result.failed
        ? // @ts-expect-error TS(2339) FIXME: Property 'shortMessage' does not exist on type 'Ex... Remove this comment to see the full error message
          `${NETLIFYDEVERR} ${result.shortMessage}`
        : `${NETLIFYDEVWARN} "${command}" exited with code ${result.exitCode}`

      log(`${errorMessage}. Shutting down Netlify Dev server`)
    }

    await cleanupBeforeExit({ exitCode: 1 })
  })
  processOnExit(async () => {
    await cleanupBeforeExit({})
  })

  return commandProcess
}

/**
 *
 * @param {object} config
 * @param {string} config.command
 * @param {*} config.error
 * @returns
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'command' implicitly has an 'any' ... Remove this comment to see the full error message
const isNonExistingCommandError = ({ command, error: commandError }) => {
  // `ENOENT` is only returned for non Windows systems
  // See https://github.com/sindresorhus/execa/pull/447
  if (commandError.code === 'ENOENT') {
    return true
  }

  // if the command is a package manager we let it report the error
  if (['yarn', 'npm', 'pnpm'].includes(command)) {
    return false
  }

  // this only works on English versions of Windows
  return (
    typeof commandError.message === 'string' &&
    commandError.message.includes('is not recognized as an internal or external command')
  )
}
