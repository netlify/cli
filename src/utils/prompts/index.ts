import process from 'process'

import * as clack from '@clack/prompts'
import type {
  AutocompleteOptions,
  ConfirmOptions as ClackConfirmOptions,
  Option,
  PasswordOptions,
  SelectOptions,
  TextOptions,
} from '@clack/prompts'

import { chalk, exit, isOutputSuppressed, NETLIFY_CYAN } from '../command-helpers.js'
import { EXIT_CODES } from '../exit-codes.js'

export type PromptOption<Value> = Option<Value>

type Cancellable<T> = T | typeof clack.CANCEL_SYMBOL
type TextValidator = Extract<NonNullable<TextOptions['validate']>, (...args: never[]) => unknown>

// Node only stops reading a piped stdin after a `pause` event. clack closes its readline with the stream already paused,
// so the handle would keep reading (and keep the process alive) after the last prompt. Cycling resume/pause emits the event.
const releaseStdin = (): void => {
  if (process.stdin.isTTY) return
  process.stdin.resume()
  process.stdin.pause()
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
  settle(await clack.text(withDefaultAwareValidation(options)))

export const promptPassword = async (options: PasswordOptions): Promise<string> => settle(await clack.password(options))

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
    value = await clack.confirm({ ...options, signal: controller.signal })
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
  settle(await clack.select(options))

export const promptAutocomplete = async <Value>(options: AutocompleteOptions<Value>): Promise<Value> =>
  settle(await clack.autocomplete(options))

export const intro = (title: string): void => {
  if (isOutputSuppressed()) return
  clack.intro(`${NETLIFY_CYAN('⬥')} ${chalk.bold(title)}`)
}

export const outro = (message: string): void => {
  if (isOutputSuppressed()) return
  clack.outro(message)
}

export const note = (message: string, title?: string): void => {
  if (isOutputSuppressed()) return
  clack.note(message, title)
}
