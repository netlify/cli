/* eslint-disable */
const sanityClient = require('@sanity/client')

/*
 * You will need to configure environment variables for Sanity.io project id,
 * dataset name, and a token with write access. The variables are named
 *
 * SANITY_PROJECTID
 * SANITY_DATASET
 * SANITY_TOKEN
 *
 * Create a Sanity.io token at https://manage.sanity.io by selecting your
 * project, going to Settings -> API and adding a new token with write access.
 *
 * Read more about configuring Netlify environment variables at
 * https://docs.netlify.com/configure-builds/environment-variables/#declare-variables
 */
const client = sanityClient({
  projectId: process.env.SANITY_PROJECTID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  useCdn: false,
})

/*
 * A function for writing to a Sanity.io dataset with a write access token.
 *
 * In this example we accept POST requests with the following JSON body
 *
 * {
 *    "author": "A name",
 *    "message": "What I want to say"
 * }
 *
 * Then we construct an object to save in Sanity.io and return the full saved
 * object back to our caller
 */
exports.handler = async event => {
  if (!event.httpMethod === 'POST') {
    return {
      statusCode: 400,
      body: 'unrecognized HTTP Method, only POST allowed',
    }
  }

  const payload = JSON.parse(event.body)
  if (!payload.message) {
    return { status: 400, body: "Missing 'message'" }
  }

  const document = {
    _type: 'comment',
    status: 'waitingApproval', // Some workflow state
    author: payload.author || 'Anonymous',
    message: payload.message,
  }

  return client
    .create(document)
    .then(result => {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }
    })
    .catch(error => {
      return {
        headers: { 'Content-Type': 'application/json' },
        statusCode: 500,
        body: error.responseBody || JSON.stringify({ error: 'An error occurred' }),
      }
    })
}
