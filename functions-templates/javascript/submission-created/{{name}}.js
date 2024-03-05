// // optionally configure local env vars
// require('dotenv').config()

// // details in https://css-tricks.com/using-netlify-forms-and-netlify-functions-to-build-an-email-sign-up-widget
const process = require('process')

const fetch = require('node-fetch')

const { EMAIL_TOKEN } = process.env
const handler = async (event) => {
  const { email } = JSON.parse(event.body).payload
  console.log(`Received a submission: ${email}`)
  try {
    const response = await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Token ${EMAIL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })
    const data = await response.json()
    console.log(`Submitted to Buttondown:\n ${data}`)
  } catch (error) {
    return { statusCode: 422, body: String(error) }
  }
}

module.exports = { handler }
