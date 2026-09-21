import { Buffer } from 'node:buffer'

interface Stdin {
  writable: boolean
  write(data: Buffer): boolean
  on(event: 'error', listener: (error: Error) => void): this
}

interface Stdout {
  on(event: 'data', listener: (buffer: Buffer) => void): this
}

interface Process {
  stdin: Stdin | null
  stdout: Stdout | null
}

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPES = /\u001B\[[0-9;?]*[A-Za-z]/g
// clack wraps long lines and prefixes continuation lines with its guide bar; joining them restores the original text
const CLACK_LINE_CONTINUATION = /\r?\n[│|] {2}/g

const normalize = (output: string): string =>
  output.replace(ANSI_ESCAPES, '').replace(CLACK_LINE_CONTINUATION, '').replace(/\r?\n/g, '')

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 *
 * @param prompts questions that you know the CLI will ask and respective answers to mock
 */
export const handleQuestions = (
  process: Process,
  questions: { question: string; answer: string | string[] }[],
  prompts: number[] = [],
): void => {
  if (process.stdout === null) {
    throw new Error('specified process does not have readable stdout')
  }

  let buffer = ''
  process.stdout.on('data', (data: Buffer) => {
    buffer += data.toString()
    const normalized = normalize(buffer)
    const index = questions.findIndex(
      ({ question }, questionIndex) => normalized.includes(question) && !prompts.includes(questionIndex),
    )
    if (index >= 0) {
      prompts.push(index)
      buffer = ''
      const { answer } = questions[index]

      writeResponse(process, Array.isArray(answer) ? answer : [answer])
    }
  })
}

const writeResponse = (process: Process, responses: string[]) => {
  if (process.stdin === null) {
    throw new Error('specified process does not have writable stdin')
  }

  const response = responses.shift()
  // the CLI may have exited already (e.g. a `y`/`n` answer submits immediately), so late keystrokes must not crash the test
  if (response && process.stdin.writable) process.stdin.write(Buffer.from(response))
  if (responses.length !== 0)
    setTimeout(() => {
      writeResponse(process, responses)
    }, 50)
}

export const answerWithValue = (value = '') => [value, CONFIRM].flat()

/** Enter. clack only submits on a carriage return (`\r`); a bare `\n` is a different key. */
export const CONFIRM = '\r'
export const DOWN = '\u001B[B'
/** Answers a confirm prompt with "No" and submits immediately; do not follow it with CONFIRM. */
export const NO = 'n'
/** Answers a confirm prompt with "Yes" and submits immediately; do not follow it with CONFIRM. */
export const YES = 'y'
