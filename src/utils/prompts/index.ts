import process from 'process'
import { stripVTControlCharacters } from 'util'

// eslint-disable-next-line no-restricted-imports -- this module is the wrapper everything else uses
import * as clack from '@clack/prompts'

import { logError } from '../command-helpers.js'
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

// Without this, a script or agent whose stdin closes would leave the prompt waiting forever.
const exitOnClosedInput = async (message: string): Promise<never> => {
  logError(
    `Input ended before "${stripVTControlCharacters(message)}" was answered. Run this command in an interactive terminal, or pass the value with a flag if it has one.`,
  )
  return exitAfterCleanup(EXIT_CODES.NON_INTERACTIVE_PROMPT)
}

const ask = async <T>(message: string, prompt: Prompt<T>, timeout?: { after: number; answer: T }): Promise<T> => {
  const controller = new AbortController()
  let abortReason: 'timeout' | 'input-ended' | undefined
  const abort = (reason: NonNullable<typeof abortReason>) => {
    abortReason = reason
    controller.abort()
  }

  // The prompt keeps its abort listener after it settles, so a late abort would close it a second time
  // and reset the terminal under whatever runs next. Both triggers are therefore cleared on settling.
  const timer =
    timeout &&
    setTimeout(() => {
      abort('timeout')
    }, timeout.after)
  let inputEnded: NodeJS.Immediate | undefined
  // `end` can fire before an answer decoded from the same final chunk has settled the prompt; deferring
  // lets that answer win.
  const onInputEnd = () => {
    inputEnded = setImmediate(() => {
      abort('input-ended')
    })
  }

  const piped = !process.stdin.isTTY
  if (piped) {
    process.stdin.prependListener('keypress', treatLineFeedAsEnter)
    if (process.stdin.readableEnded) {
      onInputEnd()
    } else {
      process.stdin.once('end', onInputEnd)
    }
  }

  let value: Cancellable<T>
  try {
    value = await prompt(controller.signal)
  } finally {
    clearTimeout(timer)
    clearImmediate(inputEnded)
    if (piped) {
      process.stdin.removeListener('keypress', treatLineFeedAsEnter)
      process.stdin.removeListener('end', onInputEnd)
      releaseStdin()
    }
  }

  if (!clack.isCancel(value)) return value
  if (timeout && abortReason === 'timeout') return timeout.answer
  if (abortReason === 'input-ended') return exitOnClosedInput(message)
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
  ask(options.message, (signal) => clack.text({ ...withDefaultValue(options), signal }))

export const promptPassword = (options: clack.PasswordOptions): Promise<string> =>
  ask(options.message, (signal) => clack.password({ ...options, signal }))

export type ConfirmOptions = Omit<clack.ConfirmOptions, 'signal'> & {
  /** Treat the prompt as declined when it goes unanswered for this many milliseconds. */
  timeout?: number
}

export const promptConfirm = ({ timeout, ...options }: ConfirmOptions): Promise<boolean> =>
  ask(
    options.message,
    (signal) => clack.confirm({ ...options, signal }),
    timeout === undefined ? undefined : { after: timeout, answer: false },
  )

export const promptMultiselect = <Value>(options: clack.MultiSelectOptions<Value>): Promise<Value[]> =>
  ask(options.message, (signal) => clack.multiselect({ ...options, signal }))

export const promptSelect = <Value>(options: clack.SelectOptions<Value>): Promise<Value> =>
  ask(options.message, (signal) => clack.select({ ...options, signal }))

// Matches what the option shows: the default filter also searches the stringified value, so options
// holding objects all match any substring of "[object Object]", and it searches the styled label, so
// a query spanning a colour boundary never matches.
const matchesLabelOrHint = <Value>(search: string, option: clack.Option<Value>): boolean =>
  stripVTControlCharacters(`${option.label ?? String(option.value)} ${option.hint ?? ''}`)
    .toLowerCase()
    .includes(search.toLowerCase())

export const promptAutocomplete = <Value>(options: clack.AutocompleteOptions<Value>): Promise<Value> =>
  ask(options.message, (signal) => clack.autocomplete({ filter: matchesLabelOrHint, ...options, signal }))
