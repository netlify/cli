const createRoute = require('./create')
const deleteRoute = require('./delete')
const readRoute = require('./read')
const readAllRoute = require('./read-all')
const updateRoute = require('./update')

const handler = async (event, context) => {
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '')
  const segments = path.split('/').filter(Boolean)

  switch (event.httpMethod) {
    case 'GET':
      // e.g. GET /.netlify/functions/fauna-crud
      if (segments.length === 0) {
        return readAllRoute.handler(event, context)
      }
      // e.g. GET /.netlify/functions/fauna-crud/123456
      if (segments.length === 1) {
        const [id] = segments
        event.id = id
        return readRoute.handler(event, context)
      }
      return {
        statusCode: 500,
        body: 'too many segments in GET request, must be either /.netlify/functions/fauna-crud or /.netlify/functions/fauna-crud/123456',
      }

    case 'POST':
      // e.g. POST /.netlify/functions/fauna-crud with a body of key value pair objects, NOT strings
      return createRoute.handler(event, context)
    case 'PUT':
      // e.g. PUT /.netlify/functions/fauna-crud/123456 with a body of key value pair objects, NOT strings
      if (segments.length === 1) {
        const [id] = segments
        event.id = id
        return updateRoute.handler(event, context)
      }
      return {
        statusCode: 500,
        body: 'invalid segments in POST request, must be /.netlify/functions/fauna-crud/123456',
      }

    case 'DELETE':
      // e.g. DELETE /.netlify/functions/fauna-crud/123456
      if (segments.length === 1) {
        const [id] = segments
        event.id = id
        return deleteRoute.handler(event, context)
      }
      return {
        statusCode: 500,
        body: 'invalid segments in DELETE request, must be /.netlify/functions/fauna-crud/123456',
      }
    default:
      return {
        statusCode: 500,
        body: 'unrecognized HTTP Method, must be one of GET/POST/PUT/DELETE',
      }
  }
}

module.exports = { handler }
