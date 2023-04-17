const { Buffer } = require('buffer')

/**
 * Utility to mock the stdin of the cli. You must provide the correct number of
 * questions correctly typed or the process will keep waiting for input.
 * @param {ExecaChildProcess<string>} process
 * @param {Array<{question: string, answer: string|string[]}>} questions
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

const answerWithValue = (value = '') => [value, CONFIRM].flat()

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
