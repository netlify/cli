import process from 'process'
import { stripVTControlCharacters } from 'util'

// eslint-disable-next-line no-restricted-imports -- this module is the wrapper everything else uses
import * as clack from '@clack/prompts'

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

const ask = async <T>(prompt: Prompt<T>, timeout?: { after: number; answer: T }): Promise<T> => {
  const controller = new AbortController()

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
    // clack never removes its abort listener, so a late abort would close the settled prompt again and
    // reset the terminal under whatever runs next.
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

// clack's default filter also matches `String(value)`, so every object option matches "[object Object]",
// and it matches the label with its ANSI styling, so a query spanning a colour change never matches.
const matchesLabelOrHint = <Value>(search: string, option: clack.Option<Value>): boolean =>
  stripVTControlCharacters(`${option.label ?? String(option.value)} ${option.hint ?? ''}`)
    .toLowerCase()
    .includes(search.toLowerCase())

export const promptAutocomplete = <Value>(options: clack.AutocompleteOptions<Value>): Promise<Value> =>
  ask((signal) => clack.autocomplete({ filter: matchesLabelOrHint, ...options, signal }))
