import process from 'process'
import readline from 'readline'
import { stripVTControlCharacters } from 'util'

import * as clack from '@clack/prompts'
import type {
  AutocompleteOptions,
  ConfirmOptions as ClackConfirmOptions,
  Option,
  PasswordOptions,
  SelectOptions,
  TextOptions,
} from '@clack/prompts'

import { chalk, isOutputSuppressed, NETLIFY_CYAN } from '../command-helpers.js'
import { EXIT_CODES } from '../exit-codes.js'
import { exitAfterCleanup } from '../shell.js'

import {
  accessibleAutocomplete,
  accessibleConfirm,
  accessiblePassword,
  accessibleSelect,
  accessibleText,
  isAccessible,
  writeLine,
} from './accessible.js'

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
// The line feed completing a CRLF pair is decoded from the same chunk as its carriage return, so it
// reaches us before the event loop turns; a line feed arriving any later is an answer of its own.
// Pairing on wall-clock time instead would be wrong, because a pipe can deliver writes seconds apart
// as chunks milliseconds apart.
let carriageReturnPending = false
const treatLineFeedAsEnter = (_char: string | undefined, key: { name?: string } | undefined): void => {
  const name = key?.name
  if (name === 'return') {
    carriageReturnPending = true
    process.nextTick(() => {
      carriageReturnPending = false
    })
    return
  }
  if (key != null && name === 'enter' && !carriageReturnPending) {
    key.name = 'return'
  }
  carriageReturnPending = false
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

const runWidget = async <T>(prompt: () => Promise<Cancellable<T>>): Promise<Cancellable<T>> => {
  const value = await withPipedInputSupport(prompt)
  releaseStdin()
  return value
}

const cancelAndExit = async (): Promise<never> => {
  if (isAccessible()) {
    writeLine(process.stdout, 'Cancelled.')
  } else {
    clack.cancel('Cancelled.')
  }
  // A command that already started a dev server or database registers asynchronous shutdown work;
  // exiting straight out of the prompt would abandon it.
  return exitAfterCleanup(EXIT_CODES.CANCELLED)
}

const settle = async <T>(value: Cancellable<T>): Promise<T> => {
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
  settle(
    isAccessible()
      ? await accessibleText(options)
      : await runWidget(() => clack.text(withDefaultAwareValidation(options))),
  )

export const promptPassword = async (options: PasswordOptions): Promise<string> =>
  settle(isAccessible() ? await accessiblePassword(options) : await runWidget(() => clack.password(options)))

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
  const timed = { ...options, signal: controller.signal }
  let value: Cancellable<boolean>
  try {
    value = isAccessible() ? await accessibleConfirm(timed) : await runWidget(() => clack.confirm(timed))
  } finally {
    clearTimeout(timer)
  }

  if (clack.isCancel(value) && controller.signal.aborted) {
    return false
  }
  return settle(value)
}

export const promptSelect = async <Value>(options: SelectOptions<Value>): Promise<Value> =>
  settle(isAccessible() ? await accessibleSelect(options) : await runWidget(() => clack.select(options)))

// Matches what the option shows: the default filter also searches the stringified value, so options
// holding objects all match any substring of "[object Object]", and it searches the styled label, so
// a query spanning a colour boundary never matches.
const matchesLabelOrHint = <Value>(search: string, option: Option<Value>): boolean =>
  stripVTControlCharacters(`${option.label ?? String(option.value)} ${option.hint ?? ''}`)
    .toLowerCase()
    .includes(search.toLowerCase())

export const promptAutocomplete = async <Value>(options: AutocompleteOptions<Value>): Promise<Value> =>
  settle(
    isAccessible()
      ? await accessibleAutocomplete(options)
      : await runWidget(() => clack.autocomplete({ filter: matchesLabelOrHint, ...options })),
  )

export const intro = (title: string): void => {
  if (isOutputSuppressed()) return
  // The glyph and the framing bars are announced as content by a screen reader, so they are worth
  // less there than the noise they add.
  if (isAccessible()) {
    writeLine(process.stdout, title)
    return
  }
  clack.intro(`${NETLIFY_CYAN('⬥')} ${chalk.bold(title)}`)
}

export const outro = (message: string): void => {
  if (isOutputSuppressed()) return
  if (isAccessible()) {
    writeLine(process.stdout, message)
    return
  }
  clack.outro(message)
}
