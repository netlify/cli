const { schedule } = require('@netlify/functions')

module.exports.handler = schedule('@daily', async () => {
  return {
    statusCode: 200,
    body: 'hello world',
  }
})
