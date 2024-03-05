import type { Context } from 'https://edge.netlify.com'

export default async (request: Request, context: Context) => {
  console.log(`There was a request from ${context.geo.city} to ${request.url}`)

  return new Response('The request to this URL was logged', {
    headers: { 'content-type': 'text/html' },
  })
}
