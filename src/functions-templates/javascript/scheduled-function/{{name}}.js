const { schedule } = require('@netlify/functions')

const formatAsDateTime = (date) => `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`

module.exports.handler = schedule('* * * * *', async () => {
  const currentExecutionTime = formatAsDateTime(new Date(Date.now()))
  console.log(`Function executed at ${currentExecutionTime}.`)

  return {
    statusCode: 200,
  }
})
