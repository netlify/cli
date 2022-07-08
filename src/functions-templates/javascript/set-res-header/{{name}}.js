export default async (request, context) => {
  const response = await context.next()
  response.headers.set('X-Your-Custom-Header', 'A custom value')
  return response
}
