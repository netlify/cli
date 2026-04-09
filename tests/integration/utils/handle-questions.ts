import { Buffer } from 'node:buffer'

interface Stdin {
  write(data: Buffer): boolean
}

interface Stdout {
  on(event: 'data', listener: (buffer: Buffer) => void): this
}

interface Process {
  stdin: Stdin | null
  stdout: Stdout | null
}

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
    buffer = (buffer + data.toString()).replace(/\n/g, '')
    const index = questions.findIndex(
      ({ question }, questionIndex) => buffer.includes(question) && !prompts.includes(questionIndex),
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
  if (response) process.stdin.write(Buffer.from(response))
  if (responses.length !== 0)
    setTimeout(() => {
      writeResponse(process, responses)
    }, 50)
}

export const answerWithValue = (value = '') => [value, CONFIRM].flat()

export const CONFIRM = '\n'
export const DOWN = '\u001B[B'
export const NO = 'n'
