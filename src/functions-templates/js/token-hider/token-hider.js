const axios = require("axios")
const qs = require("qs")

exports.handler = async function(event, context) {
  // apply our function to the queryStringParameters and assign it to a variable
  const API_PARAMS = qs.stringify(event.queryStringParameters)
  // Get env var values defined in our Netlify site UI
  const { API_SECRET = "shiba" } = process.env // TODO: change this
  // In this example, the API Key needs to be passed in the params with a key of key.
  // We're assuming that the ApiParams var will contain the initial ?
  const URL = `https://dog.ceo/api/breed/${API_SECRET}/images`

  // // optional restriction to GET calls
  // if (event.httpMethod !== "GET") return {statusCode: 404}
  // Let's log some stuff we already have.
  console.log("Constructed URL is ...", URL)

  try {
    const { data } = await axios.get(URL)
    return {
      statusCode: 200,
      body: JSON.stringify({ data }),
    }
  } catch (error) {
    const { status, statusText, headers, data } = error.response
    return {
      statusCode: error.response.status,
      body: JSON.stringify({ status, statusText, headers, data }),
    }
  }
}
