/* eslint-disable */
const sanityClient = require('@sanity/client')

/*
 * You will need to configure environment variables for Sanity project id and
 * Sanity dataset. Optionally you may also configure a Sanity token, useful for
 * reading private datasets or mutating data. The variables are named
 *
 * SANITY_PROJECTID
 * SANITY_DATASET
 * SANITY_TOKEN
 *
 * Read more about configuring environment variables at
 * https://docs.netlify.com/configure-builds/environment-variables/#declare-variables
 */
const client = sanityClient({
  projectId: process.env.SANITY_PROJECTID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  useCdn: true // `false` if you want to ensure fresh data
})

/*
 * A proxy for Sanity groq queries.
 *
 * Useful for querying private datasets with a token. Usually you will restrict
 * access to this function with for example Netlify Identity.
 *
 * Create Sanity tokens at https://manage.sanity.io
 *
 * Read more about restricting access to your functions at
 * https://www.netlify.com/blog/2018/03/29/jamstack-architecture-on-netlify-how-identity-and-functions-work-together/#restricting-access
 */
exports.handler = async event => {
  const { query = '' } = event.queryStringParameters
  // The rest of the query params are handled as parameters to the query
  const params = Object.assign({}, event.queryStringParameters, {
    query: null
  })

  return client
    .fetch(query, params)
    .then(rows => {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows)
      }
    })
    .catch(error => {
      const contentType = error.response.headers['content-type'] || 'application/json'
      return {
        headers: { 'Content-Type': contentType },
        statusCode: error.statusCode || 500,
        body: error.responseBody
      }
    })
}
