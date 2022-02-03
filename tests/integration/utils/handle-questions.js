const { Buffer } = require('buffer')

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 * @param {ExecaChildProcess<string>} process
 * @param {Array<{question: string, answer: string}>} questions
 *  - questions that you know the CLI will ask and respective answers to mock
 */
const handleQuestions = (process, questions) => {
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

const answerWithValue = (value) => `${value}${CONFIRM}`

const CONFIRM = '\n'
const DOWN = '\u001B[B'

module.exports = {
  handleQuestions,
  answerWithValue,
  CONFIRM,
  DOWN,
}
