// with thanks https://github.com/alexmacarthur/netlify-lambda-function-example/blob/68a0cdc05e201d68fe80b0926b0af7ff88f15802/lambda-src/purchase.js
const process = require('process')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const statusCode = 200
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const handler = async function (event) {
  // -- We only care to do anything if this is our POST request.
  if (event.httpMethod !== 'POST' || !event.body) {
    return {
      statusCode,
      headers,
      body: '',
    }
  }

  // -- Parse the body contents into an object.
  const data = JSON.parse(event.body)

  // -- Make sure we have all required data. Otherwise, escape.
  if (!data.token || !data.amount || !data.idempotency_key) {
    console.error('Required information is missing.')

    return {
      statusCode,
      headers,
      body: JSON.stringify({ status: 'missing-information' }),
    }
  }

  try {
    const charge = await stripe.charges.create(
      {
        currency: 'usd',
        amount: data.amount,
        source: data.token.id,
        receipt_email: data.token.email,
        description: `charge for a widget`,
      },
      {
        idempotency_key: data.idempotency_key,
      },
    )
    const status = charge === null || charge.status !== 'succeeded' ? 'failed' : charge.status
    return { statusCode, headers, body: JSON.stringify({ status }) }
  } catch (error) {
    return { statusCode: 500, error: error.message }
  }
}

module.exports = { handler }
