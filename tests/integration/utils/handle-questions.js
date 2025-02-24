import { Buffer } from 'buffer'

import ansis from 'ansis'

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 * @param {ExecaChildProcess<string>} process
 * @param {Array<{question: string, answer: string|string[]}>} questions
 * @param {Array<number>} prompts
 *  - questions that you know the CLI will ask and respective answers to mock
 */
export const handleQuestions = (process, questions, prompts = []) => {
  let buffer = ''
  process.stdout.on('data', (data) => {
    buffer = (buffer + ansis.strip(data.toString())).replace(/\n/g, '')
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

const writeResponse = (process, responses) => {
  const response = responses.shift()
  if (response) process.stdin.write(Buffer.from(response))
  if (responses.length !== 0) setTimeout(() => writeResponse(process, responses), 50)
}

export const answerWithValue = (value = '') => [value, CONFIRM].flat()

export const CONFIRM = '\n'
export const DOWN = '\u001B[B'
export const NO = 'n'
