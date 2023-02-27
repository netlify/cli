const { Buffer } = require('buffer')

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 * @param {ExecaChildProcess<string>} process
 * @param {Array<{question: string, answer: string}>} questions
 * @param {Array<number>} prompts
 *  - questions that you know the CLI will ask and respective answers to mock
 */
const handleQuestions = (process, questions, prompts = []) => {
  let buffer = ''
  process.stdout.on('data', (data) => {
    buffer = (buffer + data).replace(/\n/g, '')
    const index = questions.findIndex(
      ({ question }, questionIndex) => buffer.includes(question) && !prompts.includes(questionIndex),
    )
    if (index >= 0) {
      prompts.push(index)
      buffer = ''
      process.stdin.write(Buffer.from(questions[index].answer))
    }
  })
}

const answerWithValue = (value) => `${value}${CONFIRM}`

const CONFIRM = '\n'
const DOWN = '\u001B[B'
const NO = 'n'

module.exports = {
  handleQuestions,
  answerWithValue,
  CONFIRM,
  DOWN,
  NO,
}
