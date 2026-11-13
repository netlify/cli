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

// Node stops reading a piped stdin only on a `pause` event, and `pause()` emits none once the prompt has
// left the stream paused, so the still-reading handle would keep the process alive.
const releaseStdin = (): void => {
  process.stdin.emit('pause')
}

// clack submits only on readline's `return` key (CR); a pipe or here-doc sends LF, which readline names `enter`.
const treatLineFeedAsEnter = (_char: string | undefined, key: { name?: string } | undefined): void => {
  if (key?.name === 'enter') {
    key.name = 'return'
  }
}

const cancelAndExit = async (): Promise<never> => {
  clack.cancel('Cancelled.')
  return exitAfterCleanup(EXIT_CODES.INTERRUPTED)
}

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

  const timer =
    timeout &&
    setTimeout(() => {
      abort('timeout')
    }, timeout.after)
  let inputEnded: NodeJS.Immediate | undefined
  // clack ignores the end of input, so without this a closed stdin leaves the prompt waiting forever.
  // Deferred because `end` can fire before an answer in the same final chunk settles the prompt.
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
    // clack never removes its abort listener, so a late abort would close the settled prompt again and
    // reset the terminal under whatever runs next.
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
  // clack's text prompt never displays `defaultValue`; it only applies it on submit.
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

// clack's default filter also matches `String(value)`, so every object option matches "[object Object]",
// and it matches the label with its ANSI styling, so a query spanning a colour change never matches.
const matchesLabelOrHint = <Value>(search: string, option: clack.Option<Value>): boolean =>
  stripVTControlCharacters(`${option.label ?? String(option.value)} ${option.hint ?? ''}`)
    .toLowerCase()
    .includes(search.toLowerCase())

export const promptAutocomplete = <Value>(options: clack.AutocompleteOptions<Value>): Promise<Value> =>
  ask(options.message, (signal) => clack.autocomplete({ filter: matchesLabelOrHint, ...options, signal }))
