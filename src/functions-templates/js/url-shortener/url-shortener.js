const handler = (event, context, callback) => {
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '')
  const segments = path.split('/').filter(Boolean)
  console.log('segments', segments)

  switch (event.httpMethod) {
    case 'GET':
      // e.g. GET /.netlify/functions/url-shortener
      return require('./get-route').handler(event, context, callback)
    case 'POST':
      // e.g. POST /.netlify/functions/url-shortener
      return require('./generate-route').handler(event, context, callback)
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
