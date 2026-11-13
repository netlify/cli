import process from 'process'
import { stripVTControlCharacters } from 'util'

// eslint-disable-next-line no-restricted-imports -- this module is the wrapper everything else uses
import * as clack from '@clack/prompts'

import { EXIT_CODES } from '../exit-codes.js'
import { exitAfterCleanup } from '../shell.js'

type Cancellable<T> = T | typeof clack.CANCEL_SYMBOL
type Prompt<T> = (signal: AbortSignal) => Promise<Cancellable<T>>
type TextValidator = Extract<NonNullable<clack.TextOptions['validate']>, (...args: never[]) => unknown>

// Node only stops reading a piped stdin when it sees a `pause` event, and the prompt leaves the stream
// already paused, so the handle would keep reading and hold the process open. Emitting the event directly
// stops the read without resuming first, which would flush input meant for the next prompt.
const releaseStdin = (): void => {
  process.stdin.emit('pause')
}

// The prompts submit on a carriage return, but a pipe or a here-doc sends a line feed.
const treatLineFeedAsEnter = (_char: string | undefined, key: { name?: string } | undefined): void => {
  if (key?.name === 'enter') {
    key.name = 'return'
  }
}

const cancelAndExit = async (): Promise<never> => {
  clack.cancel('Cancelled.')
  // A command that already started a dev server or database registers asynchronous shutdown work;
  // exiting straight out of the prompt would abandon it.
  return exitAfterCleanup(EXIT_CODES.INTERRUPTED)
}

const ask = async <T>(prompt: Prompt<T>, timeout?: { after: number; answer: T }): Promise<T> => {
  const controller = new AbortController()

  // The prompt keeps its abort listener after it settles, so a late abort would close it a second time
  // and reset the terminal under whatever runs next. The timer is therefore cleared on settling.
  const timer =
    timeout &&
    setTimeout(() => {
      controller.abort()
    }, timeout.after)

  const piped = !process.stdin.isTTY
  if (piped) {
    process.stdin.prependListener('keypress', treatLineFeedAsEnter)
  }

  let value: Cancellable<T>
  try {
    value = await prompt(controller.signal)
  } finally {
    clearTimeout(timer)
    if (piped) {
      process.stdin.removeListener('keypress', treatLineFeedAsEnter)
      releaseStdin()
    }
  }

  if (!clack.isCancel(value)) return value
  if (timeout && controller.signal.aborted) return timeout.answer
  return cancelAndExit()
}

const withDefaultValue = (options: clack.TextOptions): clack.TextOptions => {
  const { defaultValue, validate } = options
  if (defaultValue === undefined) {
    return options
  }
  // clack only applies `defaultValue` on submit, so show it as well
  const shown = { placeholder: defaultValue, ...options }
  if (typeof validate !== 'function') {
    return shown
  }
  // clack validates the raw input before falling back to `defaultValue`, so a validator requiring a value
  // would otherwise reject accepting the default.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- clack submits an empty answer as ''
  const validateWithDefault: TextValidator = (value) => validate(value || defaultValue)
  return { ...shown, validate: validateWithDefault }
}

export const promptText = (options: clack.TextOptions): Promise<string> =>
  ask((signal) => clack.text({ ...withDefaultValue(options), signal }))

export const promptPassword = (options: clack.PasswordOptions): Promise<string> =>
  ask((signal) => clack.password({ ...options, signal }))

export type ConfirmOptions = Omit<clack.ConfirmOptions, 'signal'> & {
  /** Treat the prompt as declined when it goes unanswered for this many milliseconds. */
  timeout?: number
}

export const promptConfirm = ({ timeout, ...options }: ConfirmOptions): Promise<boolean> =>
  ask(
    (signal) => clack.confirm({ ...options, signal }),
    timeout === undefined ? undefined : { after: timeout, answer: false },
  )

export const promptMultiselect = <Value>(options: clack.MultiSelectOptions<Value>): Promise<Value[]> =>
  ask((signal) => clack.multiselect({ ...options, signal }))

export const promptSelect = <Value>(options: clack.SelectOptions<Value>): Promise<Value> =>
  ask((signal) => clack.select({ ...options, signal }))

// Matches what the option shows: the default filter also searches the stringified value, so options
// holding objects all match any substring of "[object Object]", and it searches the styled label, so
// a query spanning a colour boundary never matches.
const matchesLabelOrHint = <Value>(search: string, option: clack.Option<Value>): boolean =>
  stripVTControlCharacters(`${option.label ?? String(option.value)} ${option.hint ?? ''}`)
    .toLowerCase()
    .includes(search.toLowerCase())

export const promptAutocomplete = <Value>(options: clack.AutocompleteOptions<Value>): Promise<Value> =>
  ask((signal) => clack.autocomplete({ filter: matchesLabelOrHint, ...options, signal }))
