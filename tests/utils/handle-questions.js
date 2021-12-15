import { Buffer } from 'buffer'

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 * @param {ExecaChildProcess<string>} process
 * @param {Array<{question: string, answer: string}>} questions
 *  - questions that you know the CLI will ask and respective answers to mock
 */
export const handleQuestions = (process, questions) => {
  const remainingQuestions = [...questions]
  let buffer = ''
  process.stdout.on('data', (data) => {
    buffer += data
    const index = remainingQuestions.findIndex(({ question }) => buffer.includes(question))
    if (index >= 0) {
      buffer = ''
      process.stdin.write(Buffer.from(remainingQuestions[index].answer))
      remainingQuestions.splice(index, 1)
    }
  })
}

export const answerWithValue = (value) => `${value}${CONFIRM}`

export const CONFIRM = '\n'
export const DOWN = '\u001B[B'
