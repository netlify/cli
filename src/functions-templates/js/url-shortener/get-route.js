'use strict'
const process = require('process')

const fetch = require('fetch')

module.exports = async function handler(event) {
  // which URL code are we trying to retrieve?
  const { code } = event.queryStringParameters

  try {
    const response = await fetch(
      `https://api.netlify.com/api/v1/forms/${process.env.ROUTES_FORM_ID}/submissions/?access_token=${process.env.API_AUTH}`,
    )
    const body = await response.text()

    if (response.statusCode !== 200) {
      return { statusCode: 500, body }
    }

    const {
      data: { destination },
    } = body.find(({ data }) => data.code === code)
    console.log(`We searched for ${code} and we found ${destination}`)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, url: destination }),
    }
  } catch (error) {
    return { statusCode: 500, body: error.message }
  }
}
