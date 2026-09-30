import process from 'process'
import { type Readable, type Writable } from 'stream'
import { StringDecoder } from 'string_decoder'
import { stripVTControlCharacters } from 'util'

import { CANCEL_SYMBOL, settings } from '@clack/prompts'
import type {
  AutocompleteOptions,
  ConfirmOptions,
  Option,
  PasswordOptions,
  SelectOptions,
  TextOptions,
} from '@clack/prompts'

type Cancellable<T> = T | typeof CANCEL_SYMBOL

/**
 * Whether prompts should be written as plain questions and answers instead of as a widget that
 * repaints itself.
 *
 * A screen reader announces a terminal by reading what is written to it, so a prompt that redraws on
 * every keystroke is read out again from the top each time, and the cursor movements that redraw it
 * are announced as content. This resolves the way the prompt library documents, so a caller can force
 * it either way with `updateSettings({ accessible })`, and it keeps working if the library ever
 * renders accessibly itself.
 */
export const isAccessible = (): boolean => {
  if (settings.accessible !== undefined) {
    return settings.accessible
  }
  const value = process.env.ACCESSIBLE
  return value !== undefined && value !== '' && value !== '0' && value !== 'false'
}

const ETX = '\u0003'
const EOT = '\u0004'
const ERASE = new Set(['\u0008', '\u007F'])

/**
 * Hands out one line at a time from a stream it only listens to while a prompt is waiting.
 *
 * A prompt cannot keep what it over-read to itself, because a pipe can deliver several answers in one
 * chunk: the lines it does not consume have to wait somewhere for the next prompt, which is why the
 * reader outlives the prompt. It stops listening in between, so the rest of the CLI — `netlify dev`
 * forwarding stdin to a framework server, above all — gets the stream back untouched.
 */
class LineReader {
  private readonly decoder = new StringDecoder('utf8')
  private readonly lines: Cancellable<string>[] = []
  private partial = ''
  private afterCarriageReturn = false
  private ended = false
  private hidingInput = false
  private listening = false
  private wake: (() => void) | undefined
  private readonly input: Readable

  constructor(input: Readable) {
    this.input = input
  }

  private readonly onData = (chunk: Buffer | string): void => {
    this.receive(typeof chunk === 'string' ? chunk : this.decoder.write(chunk))
  }

  private readonly onEnd = (): void => {
    this.finish()
  }

  private finish(): void {
    this.ended = true
    this.wake?.()
  }

  private listen(): void {
    if (this.listening) {
      return
    }
    this.listening = true
    this.input.on('data', this.onData)
    this.input.on('end', this.onEnd)
    this.input.on('close', this.onEnd)
  }

  private release(): void {
    if (!this.listening) {
      return
    }
    this.listening = false
    this.input.off('data', this.onData)
    this.input.off('end', this.onEnd)
    this.input.off('close', this.onEnd)
    this.input.pause()
    // Node only stops reading a piped stdin when it sees a `pause` event, and `pause()` emits nothing when
    // the stream is already paused. Reading one more chunk than it needed would then hold the process open,
    // because a stream restarts its read after every chunk it takes.
    if (!isTerminal(this.input)) {
      this.input.emit('pause')
    }
  }

  private endLine(line: Cancellable<string>): void {
    this.lines.push(line)
    this.partial = ''
  }

  private receive(text: string): void {
    for (const char of text) {
      const afterCarriageReturn = this.afterCarriageReturn
      this.afterCarriageReturn = char === '\r'

      if (char === '\r') {
        this.endLine(this.partial)
      } else if (char === '\n') {
        // The line feed closing a CRLF pair ends the line its carriage return already ended.
        if (!afterCarriageReturn) {
          this.endLine(this.partial)
        }
      } else if (!this.hidingInput) {
        this.partial += char
      } else if (char === ETX) {
        // Hiding input means raw mode, which delivers Ctrl+C and Ctrl+D as input rather than as a
        // signal and an end of stream.
        this.endLine(CANCEL_SYMBOL)
      } else if (char === EOT) {
        this.finish()
      } else if (ERASE.has(char)) {
        this.partial = this.partial.slice(0, -1)
      } else {
        this.partial += char
      }
    }

    if (this.lines.length !== 0) {
      this.wake?.()
    }
  }

  private waitForInput(signal: AbortSignal | undefined): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        this.wake = undefined
        signal?.removeEventListener('abort', done)
        resolve()
      }
      this.wake = done
      signal?.addEventListener('abort', done, { once: true })
      this.listen()
      this.input.resume()
    })
  }

  async read({
    hideInput,
    signal,
  }: {
    hideInput: boolean
    signal: AbortSignal | undefined
  }): Promise<Cancellable<string>> {
    this.hidingInput = hideInput
    const restoreEcho = hideInput ? suppressEcho(this.input) : undefined
    try {
      for (;;) {
        const line = this.lines.shift()
        if (line !== undefined) {
          return line
        }
        if (this.ended || this.input.readableEnded || signal?.aborted === true) {
          return CANCEL_SYMBOL
        }
        await this.waitForInput(signal)
      }
    } finally {
      this.hidingInput = false
      if (restoreEcho !== undefined) {
        restoreEcho()
        // Raw mode ends a line with a carriage return and the driver sends a line feed once it is off
        // again, so the next line feed answers the next question rather than closing this one.
        this.afterCarriageReturn = false
      }
      this.release()
    }
  }
}

type MaybeTTY = Readable & { isTTY?: boolean; isRaw?: boolean; setRawMode?: (mode: boolean) => void }

const isTerminal = (input: Readable): boolean => (input as MaybeTTY).isTTY === true

/** Keeps a secret out of the scrollback, at the cost of every line editing key but erase. */
const suppressEcho = (input: Readable): (() => void) | undefined => {
  const tty = input as MaybeTTY
  if (tty.isTTY !== true || typeof tty.setRawMode !== 'function') {
    return undefined
  }
  const wasRaw = tty.isRaw === true
  tty.setRawMode(true)
  return () => {
    tty.setRawMode?.(wasRaw)
  }
}

const readers = new WeakMap<Readable, LineReader>()

const readerFor = (input: Readable): LineReader => {
  const existing = readers.get(input)
  if (existing !== undefined) {
    return existing
  }
  const reader = new LineReader(input)
  readers.set(input, reader)
  return reader
}

interface PromptStreams {
  input?: Readable | undefined
  output?: Writable | undefined
  signal?: AbortSignal | undefined
}

const streamsOf = ({ input, output, signal }: PromptStreams): PromptStreams => ({ input, output, signal })

export const writeLine = (output: Writable | undefined, text = ''): void => {
  const target = output ?? process.stdout
  target.write(`${text}\n`)
}

type Question = PromptStreams & { hideInput?: boolean }

const ask = async (
  question: string,
  { input = process.stdin, output = process.stdout, signal, hideInput = false }: Question,
): Promise<Cancellable<string>> => {
  output.write(question)
  const answer = await readerFor(input).read({ hideInput, signal })
  // A terminal echoes what was typed, newline included, unless we have just told it not to.
  if (hideInput || !isTerminal(input)) {
    writeLine(output)
  }
  return answer
}

type MaybePromise<T> = T | Promise<T>
type ValidationProblem = string | Error | undefined
type Validator<Value> =
  | ((value: Value | undefined) => MaybePromise<ValidationProblem>)
  | {
      '~standard': {
        validate: (value: Value) => MaybePromise<{ issues?: readonly { message: string }[] | undefined }>
      }
    }

const runValidation = async <Value>(
  validate: Validator<Value> | undefined,
  value: Value,
): Promise<ValidationProblem> => {
  if (validate === undefined) {
    return undefined
  }
  if (typeof validate === 'function') {
    return validate(value)
  }
  const { issues } = await validate['~standard'].validate(value)
  return issues === undefined || issues.length === 0 ? undefined : issues[0].message
}

/** An accepted answer, wrapped so that any value at all can be told apart from a problem to report. */
type Accepted<Value> = [Value]

const askUntilAccepted = async <Value>(
  question: string,
  streams: Question,
  accept: (answer: string) => MaybePromise<Accepted<Value> | string | Error>,
): Promise<Cancellable<Value>> => {
  for (;;) {
    const answer = await ask(question, streams)
    if (typeof answer !== 'string') {
      return answer
    }

    const result = await accept(answer)
    if (Array.isArray(result)) {
      return result[0]
    }
    writeLine(streams.output, result instanceof Error ? result.message : result)
  }
}

const plain = (text: string): string => stripVTControlCharacters(text)

// Several messages already end in a colon, and a screen reader reads the one this appends as a second.
const asQuestion = (message: string): string => plain(message).replace(/\s*:\s*$/, '')

const describeBlankAnswer = ({ defaultValue, initialValue, placeholder }: TextOptions): string => {
  const submittedWhenBlank = initialValue || defaultValue
  if (submittedWhenBlank) {
    return ` [${plain(submittedWhenBlank)}]`
  }
  // A placeholder is only an example: a blank answer submits nothing, so it must not read as a default.
  return placeholder ? ` (for example ${plain(placeholder)})` : ''
}

export const accessibleText = async (options: TextOptions): Promise<Cancellable<string>> => {
  const { defaultValue, initialValue, message, validate } = options

  const question = `${asQuestion(message)}${describeBlankAnswer(options)}: `

  return askUntilAccepted(question, streamsOf(options), async (answer) => {
    const value = answer === '' ? initialValue || defaultValue || '' : answer
    const problem = await runValidation(validate, value)
    return problem ?? [value]
  })
}

export const accessiblePassword = async (options: PasswordOptions): Promise<Cancellable<string>> => {
  const { message, validate } = options

  return askUntilAccepted(`${asQuestion(message)}: `, { ...streamsOf(options), hideInput: true }, async (answer) => {
    const problem = await runValidation(validate, answer)
    return problem ?? [answer]
  })
}

export const accessibleConfirm = async (options: ConfirmOptions): Promise<Cancellable<boolean>> => {
  const { active = 'Yes', inactive = 'No', initialValue = true, message } = options
  const affirmative = new Set(['y', 'yes', active.toLowerCase()])
  const negative = new Set(['n', 'no', inactive.toLowerCase()])
  const question = `${asQuestion(message)} [${initialValue ? 'Y/n' : 'y/N'}]: `

  return askUntilAccepted<boolean>(question, streamsOf(options), (answer) => {
    const normalized = plain(answer).trim().toLowerCase()
    if (normalized === '') {
      return [initialValue]
    }
    if (affirmative.has(normalized)) {
      return [true]
    }
    if (negative.has(normalized)) {
      return [false]
    }
    return `Enter ${active} or ${inactive}.`
  })
}

const chooseFrom = async <Value>(
  message: string,
  options: Option<Value>[],
  initialValue: Value | undefined,
  streams: PromptStreams,
): Promise<Cancellable<Value>> => {
  const choices = options.filter((option) => option.disabled !== true)
  if (choices.length === 0) {
    throw new Error(`No options to choose from for "${plain(message)}"`)
  }

  const initialIndex = choices.findIndex((option) => option.value === initialValue)
  const fallback = initialIndex === -1 ? 0 : initialIndex

  writeLine(streams.output, plain(message))
  choices.forEach((option, index) => {
    const hint = option.hint == null ? '' : ` (${plain(option.hint)})`
    writeLine(streams.output, `  ${String(index + 1)}. ${plain(option.label ?? String(option.value))}${hint}`)
  })

  const range = `a number between 1 and ${String(choices.length)}`
  return askUntilAccepted<Value>(`Enter ${range} [${String(fallback + 1)}]: `, streams, (answer) => {
    const trimmed = plain(answer).trim()
    if (trimmed === '') {
      return [choices[fallback].value]
    }
    const index = Number(trimmed)
    if (!Number.isInteger(index) || index < 1 || index > choices.length) {
      return `Enter ${range}.`
    }
    return [choices[index - 1].value]
  })
}

export const accessibleSelect = async <Value>(options: SelectOptions<Value>): Promise<Cancellable<Value>> =>
  chooseFrom(options.message, options.options, options.initialValue, streamsOf(options))

/**
 * Listing every option replaces the search field: narrowing a list as you type only helps if you can
 * watch it shrink, which is what this mode exists to avoid. A dynamic options getter is called
 * without a prompt to read a search term from, for the same reason.
 */
export const accessibleAutocomplete = async <Value>(
  options: AutocompleteOptions<Value>,
): Promise<Cancellable<Value>> => {
  const listOptions = options.options
  const choices = typeof listOptions === 'function' ? listOptions.call(undefined as never) : listOptions
  return chooseFrom(options.message, choices, options.initialValue, streamsOf(options))
}
