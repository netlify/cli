import process from 'process'
import { Transform } from 'stream'
import { stripVTControlCharacters } from 'util'

import execa from 'execa'

import type { Spinner } from '../lib/spinner.js'

import { chalk, log, NETLIFYDEVERR, NETLIFYDEVWARN } from './command-helpers.js'
import { processOnExit } from './dev.js'

const isErrnoException = (value: unknown): value is NodeJS.ErrnoException =>
  value instanceof Error && Object.hasOwn(value, 'code')

type CommandResult = {
  exitCode?: number
  message?: string
  shortMessage?: string
  stderr?: string
  stdout?: string
}

const isCommandResult = (value: unknown): value is CommandResult =>
  typeof value === 'object' &&
  value !== null &&
  (('exitCode' in value && typeof value.exitCode === 'number') ||
    ('message' in value && typeof value.message === 'string') ||
    ('shortMessage' in value && typeof value.shortMessage === 'string') ||
    ('stderr' in value && typeof value.stderr === 'string') ||
    ('stdout' in value && typeof value.stdout === 'string'))

// With `reject: false`, a failed command resolves to an `ExecaError` instead of rejecting
const isFailedResult = (result: execa.ExecaReturnValue | execa.ExecaError): result is execa.ExecaError => result.failed

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const getCommandName = (command: string) => {
  const match = /^(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(command.trim())

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? command
}

export const canReportMissingCommandName = (command: string) =>
  !/(?:&&|\|\||[|;<>])/.test(command) && !/^\s*[\w.-]+=/.test(command)

export const shouldUseShell = (command: string) =>
  /(?:&&|\|\||[|;<>])/.test(command) || /^\s*[\w.-]+=(?:"[^"]*"|'[^']*'|\S+)\s+\S/.test(command)

const isMissingCommandMessage = ({ command, output }: { command: string; output: string }) =>
  output.split(/\r?\n/).some((line) => {
    const commandPattern = escapeRegExp(command)
    const missingCommandPatterns = [
      new RegExp(`(?:^|:)\\s*${commandPattern}\\s*:\\s*(?:command\\s+)?not found(?:\\s|$)`, 'i'),
      new RegExp(`(?:^|\\s)command not found:\\s*${commandPattern}(?:\\s|$)`, 'i'),
      new RegExp(`(?:^|\\s|['"])${commandPattern}['"]?\\s+is not recognized as an internal or external command`, 'i'),
    ]

    return missingCommandPatterns.some((pattern) => pattern.test(line))
  })

const createStripAnsiControlCharsStream = (): Transform =>
  new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      callback(null, stripVTControlCharacters(chunk.toString()))
    },
  })

const cleanupWork: (() => Promise<void>)[] = []

let cleanupStarted = false
let cleanupRegistered = false

const cleanupBeforeExit = async ({ exitCode }: { exitCode?: number | undefined } = {}) => {
  // If cleanup has started, then wherever started it will be responsible for exiting
  if (!cleanupStarted) {
    cleanupStarted = true
    try {
      await Promise.all(cleanupWork.map((cleanup) => cleanup()))
    } finally {
      // eslint-disable-next-line n/no-process-exit
      process.exit(exitCode)
    }
  }
}

const ensureCleanupOnExit = () => {
  if (!cleanupRegistered) {
    cleanupRegistered = true
    processOnExit(() => {
      void cleanupBeforeExit({})
    })
  }
}

/**
 * Registers a cleanup function to run before the process exits. The process
 * will call `process.exit()` after all registered cleanup functions complete.
 */
export const runBeforeProcessExit = (fn: () => Promise<void>) => {
  cleanupWork.push(fn)
  ensureCleanupOnExit()
}

// TODO(serhalp): Move (or at least rename). This sounds like a generic shell util but it's specific
// to `netlify dev`...
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
    shell: shouldUseShell(command),
    // we use reject=false to avoid rejecting synchronously when the command doesn't exist
    reject: false,
    env: {
      // Include process.env so injected env vars are passed to child process
      ...process.env,
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
  const pipeDataWithSpinner = (writeStream: NodeJS.WriteStream, chunk: string | Uint8Array) => {
    // Clear the spinner, write the framework command line, then resume spinning
    if (spinner?.isSpinning()) {
      spinner.clear()
    }
    writeStream.write(chunk, () => {
      if (spinner?.isSpinning()) {
        spinner.spin()
      }
    })
  }

  commandProcess.stdout
    ?.pipe(createStripAnsiControlCharsStream())
    .on('data', pipeDataWithSpinner.bind(null, process.stdout))
  commandProcess.stderr
    ?.pipe(createStripAnsiControlCharsStream())
    .on('data', pipeDataWithSpinner.bind(null, process.stderr))
  if (commandProcess.stdin != null) {
    process.stdin.pipe(commandProcess.stdin)
  }

  // we can't try->await->catch since we don't want to block on the framework server which
  // is a long running process
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  commandProcess.then(async () => {
    const result = await commandProcess
    const commandWithoutArgs = getCommandName(command)
    if (
      result.failed &&
      canReportMissingCommandName(command) &&
      isNonExistingCommandError({ command: commandWithoutArgs, error: result })
    ) {
      log(
        `${NETLIFYDEVERR} Failed running command: ${command}. Please verify ${chalk.magenta(
          `'${commandWithoutArgs}'`,
        )} exists`,
      )
    } else {
      const errorMessage = isFailedResult(result)
        ? `${NETLIFYDEVERR} ${result.shortMessage}`
        : `${NETLIFYDEVWARN} "${command}" exited with code ${result.exitCode.toString()}`

      log(`${errorMessage}. Shutting down Netlify Dev server`)
    }

    await cleanupBeforeExit({ exitCode: 1 })
  })
  ensureCleanupOnExit()

  return commandProcess
}

export const isNonExistingCommandError = ({ command, error: commandError }: { command: string; error: unknown }) => {
  // `ENOENT` is only returned for non Windows systems
  // See https://github.com/sindresorhus/execa/pull/447
  if (isErrnoException(commandError) && commandError.code === 'ENOENT') {
    return true
  }

  // if the command is a package manager we let it report the error
  if (['yarn', 'npm', 'pnpm'].includes(command)) {
    return false
  }

  if (!isCommandResult(commandError)) {
    return false
  }

  const output = [commandError.message, commandError.shortMessage, commandError.stderr, commandError.stdout]
    .filter((value): value is string => typeof value === 'string')
    .join('\n')

  return isMissingCommandMessage({ command, output })
}
