const generateRoute = require('./generate-route.js')
const getRoute = require('./get-route.js')

const handler = async (event) => {
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '')
  const segments = path.split('/').filter(Boolean)
  console.log('segments', segments)

  switch (event.httpMethod) {
    case 'GET':
      // e.g. GET /.netlify/functions/url-shortener
      return getRoute(event)
    case 'POST':
      // e.g. POST /.netlify/functions/url-shortener
      return generateRoute(event)
    case 'PUT':
      // your code here
      return
    case 'DELETE':
      // your code here
      return
    default:
      return {
        statusCode: 500,
        error: `unrecognized HTTP Method ${event.httpMethod}, must be one of GET/POST/PUT/DELETE`,
      }
  }
}

module.exports = { handler }
