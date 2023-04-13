const { schedule } = require('@netlify/functions')

module.exports.handler = schedule('@daily', async (event) => {
  const { next_run } = JSON.parse(event.body)

  return {
    statusCode: !!next_run ? 200 : 400,
  }
})
