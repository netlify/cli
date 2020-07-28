exports.handler = async (event, context) => {
  const path = event.path.replace(/\.netlify\/functions\/[^/]+/, '')
  const segments = path.split('/').filter(e => e)

  switch (event.httpMethod) {
    case 'GET':
      // e.g. GET /.netlify/functions/fauna-crud
      if (segments.length === 0) {
        return require('./read-all').handler(event, context)
      }
      // e.g. GET /.netlify/functions/fauna-crud/123456
      if (segments.length === 1) {
        event.id = segments[0]
        return require('./read').handler(event, context)
      } else {
        return {
          statusCode: 500,
          body:
            'too many segments in GET request, must be either /.netlify/functions/fauna-crud or /.netlify/functions/fauna-crud/123456',
        }
      }
    case 'POST':
      // e.g. POST /.netlify/functions/fauna-crud with a body of key value pair objects, NOT strings
      return require('./create').handler(event, context)
    case 'PUT':
      // e.g. PUT /.netlify/functions/fauna-crud/123456 with a body of key value pair objects, NOT strings
      if (segments.length === 1) {
        event.id = segments[0]
        return require('./update').handler(event, context)
      } else {
        return {
          statusCode: 500,
          body: 'invalid segments in POST request, must be /.netlify/functions/fauna-crud/123456',
        }
      }
    case 'DELETE':
      // e.g. DELETE /.netlify/functions/fauna-crud/123456
      if (segments.length === 1) {
        event.id = segments[0]
        return require('./delete').handler(event, context)
      } else {
        return {
          statusCode: 500,
          body: 'invalid segments in DELETE request, must be /.netlify/functions/fauna-crud/123456',
        }
      }
  }
  return {
    statusCode: 500,
    body: 'unrecognized HTTP Method, must be one of GET/POST/PUT/DELETE',
  }
}
