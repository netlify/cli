export default async (request, context) => {
  request.headers.set('X-Your-Custom-Header', 'Your custom header value')
}
