// with thanks https://github.com/LukeMwila/stripe-subscriptions-backend/blob/master/stripe-api/index.ts
const process = require('process')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const respond = (fulfillmentText) => ({
  statusCode: 200,
  body: JSON.stringify(fulfillmentText),
  headers: {
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
})

const handler = async function (event) {
  let incoming
  try {
    incoming = JSON.parse(event.body)
  } catch (error) {
    console.error(`error with parsing function parameters:`, error)
    return {
      statusCode: 400,
      body: JSON.stringify(error),
    }
  }
  try {
    const { stripeToken, email, productPlan } = incoming
    const data = await createCustomerAndSubscribeToPlan(stripeToken, email, productPlan)
    return respond(data)
  } catch (error) {
    return respond(error)
  }
}

const createCustomerAndSubscribeToPlan = async function (stripeToken, email, productPlan) {
  // create a customer
  const customer = await stripe.customers.create({
    email,
    source: stripeToken,
  })
  // retrieve created customer id to add customer to subscription plan
  const customerId = customer.id
  // create a subscription for the newly created customer
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ plan: productPlan }],
  })
  return subscription
}

module.exports = { handler }
