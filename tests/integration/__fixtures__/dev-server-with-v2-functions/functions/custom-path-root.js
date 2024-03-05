export default async (req) => new Response(`With literal path: ${req.url}`)

export const config = {
  path: '/',
  method: 'GET',
}
