const generateRoute = require('./generate-route')
const getRoute = require('./get-route')

const handler = (event, context, callback) => {
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '')
  const segments = path.split('/').filter(Boolean)
  console.log('segments', segments)

  switch (event.httpMethod) {
    case 'GET':
      // e.g. GET /.netlify/functions/url-shortener
      return getRoute(event, context, callback)
    case 'POST':
      // e.g. POST /.netlify/functions/url-shortener
      return generateRoute(event, context, callback)
    case 'PUT':
      // your code here
      return
    case 'DELETE':
      // your code here
      return
    default:
      return callback(new Error('unrecognized HTTP Method, must be one of GET/POST/PUT/DELETE'))
  }
}

module.exports = { handler }
