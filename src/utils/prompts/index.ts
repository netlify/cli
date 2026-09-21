import process from 'process'
import readline from 'readline'

import * as clack from '@clack/prompts'
import type {
  AutocompleteOptions,
  ConfirmOptions as ClackConfirmOptions,
  PasswordOptions,
  SelectOptions,
  TextOptions,
} from '@clack/prompts'

import { chalk, exit, isOutputSuppressed, NETLIFY_CYAN } from '../command-helpers.js'
import { EXIT_CODES } from '../exit-codes.js'

type Cancellable<T> = T | typeof clack.CANCEL_SYMBOL
type TextValidator = Extract<NonNullable<TextOptions['validate']>, (...args: never[]) => unknown>

// Node only stops reading a piped stdin when it sees a `pause` event, and the prompt leaves the stream
// already paused, so the handle would keep reading and hold the process open. Emitting the event directly
// stops the read without resuming first, which would flush input meant for the next prompt.
const releaseStdin = (): void => {
  if (process.stdin.isTTY) return
  process.stdin.emit('pause')
}

// The prompts submit on a carriage return, which is what a terminal sends, but a pipe or a here-doc
// sends a line feed. Without this, `printf 'value\n' | netlify …` would leave the prompt unanswered.
let previousKeyName: string | undefined
const treatLineFeedAsEnter = (_char: string | undefined, key: { name?: string } | undefined): void => {
  const name = key?.name
  // A line feed closing a CRLF pair belongs to the carriage return that already submitted.
  if (key != null && name === 'enter' && previousKeyName !== 'return') {
    key.name = 'return'
  }
  previousKeyName = name
}

const withPipedInputSupport = async <T>(prompt: () => Promise<T>): Promise<T> => {
  if (process.stdin.isTTY) {
    return prompt()
  }
  readline.emitKeypressEvents(process.stdin)
  process.stdin.prependListener('keypress', treatLineFeedAsEnter)
  try {
    return await prompt()
  } finally {
    process.stdin.removeListener('keypress', treatLineFeedAsEnter)
  }
}

const cancelAndExit = (): never => {
  clack.cancel('Cancelled.')
  return exit(EXIT_CODES.CANCELLED)
}

const settle = <T>(value: Cancellable<T>): T => {
  releaseStdin()
  if (clack.isCancel(value)) {
    return cancelAndExit()
  }
  return value
}

// clack validates the raw input before falling back to `defaultValue`, so accepting a default would otherwise be
// rejected by validators that require a value.
const withDefaultAwareValidation = (options: TextOptions): TextOptions => {
  const { defaultValue, validate } = options
  if (defaultValue === undefined || typeof validate !== 'function') {
    return options
  }
  const validateWithDefault: TextValidator = (value) => validate(value || defaultValue)
  return { ...options, validate: validateWithDefault }
}

export const promptText = async (options: TextOptions): Promise<string> =>
  settle(await withPipedInputSupport(() => clack.text(withDefaultAwareValidation(options))))

export const promptPassword = async (options: PasswordOptions): Promise<string> =>
  settle(await withPipedInputSupport(() => clack.password(options)))

export type ConfirmOptions = Omit<ClackConfirmOptions, 'signal'> & {
  /** Treat the prompt as declined when it goes unanswered for this many milliseconds. */
  timeout?: number
}

/**
 * A prompt left unanswered past its `timeout` resolves to `false`; only an explicit user cancellation
 * exits the process.
 */
export const promptConfirm = async ({ timeout, ...options }: ConfirmOptions): Promise<boolean> => {
  const controller = new AbortController()
  // The prompt keeps its abort listener attached after it settles, so a timer left running would close
  // it a second time and reset the terminal under whatever is running by then.
  const timer =
    timeout == null
      ? undefined
      : setTimeout(() => {
          controller.abort()
        }, timeout)
  let value: Cancellable<boolean>
  try {
    value = await withPipedInputSupport(() => clack.confirm({ ...options, signal: controller.signal }))
  } finally {
    clearTimeout(timer)
  }

  if (clack.isCancel(value) && controller.signal.aborted) {
    releaseStdin()
    return false
  }
  return settle(value)
}

export const promptSelect = async <Value>(options: SelectOptions<Value>): Promise<Value> =>
  settle(await withPipedInputSupport(() => clack.select(options)))

export const promptAutocomplete = async <Value>(options: AutocompleteOptions<Value>): Promise<Value> =>
  settle(await withPipedInputSupport(() => clack.autocomplete(options)))

export const intro = (title: string): void => {
  if (isOutputSuppressed()) return
  clack.intro(`${NETLIFY_CYAN('⬥')} ${chalk.bold(title)}`)
}

export const outro = (message: string): void => {
  if (isOutputSuppressed()) return
  clack.outro(message)
}
