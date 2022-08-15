export default async (request) => {
  return new Response('Hello, World!', {
    headers: { 'content-type': 'text/html' },
  })
}
