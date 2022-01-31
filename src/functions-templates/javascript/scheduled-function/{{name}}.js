const { schedule } = require('@netlify/functions')

module.exports.handler = schedule('* * * * *', async () => {
  console.log(`Function executed at ${new Date()}.`)

  return {
    statusCode: 200,
  }
})
