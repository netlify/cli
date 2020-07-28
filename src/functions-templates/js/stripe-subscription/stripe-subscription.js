// with thanks https://github.com/LukeMwila/stripe-subscriptions-backend/blob/master/stripe-api/index.ts

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const respond = fulfillmentText => {
  return {
    statusCode: 200,
    body: JSON.stringify(fulfillmentText),
    headers: {
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  }
}

exports.handler = async function(event, context) {
  let incoming
  try {
    incoming = JSON.parse(event.body)
  } catch (err) {
    console.error(`error with parsing function parameters: `, err)
    return {
      statusCode: 400,
      body: JSON.stringify(err),
    }
  }
  try {
    const { stripeToken, email, productPlan } = incoming
    const data = await createCustomerAndSubscribeToPlan(stripeToken, email, productPlan)
    return respond(data)
  } catch (err) {
    return respond(err)
  }
}

async function createCustomerAndSubscribeToPlan(stripeToken, email, productPlan) {
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
