export default async (req) => new Response(`Catchall Path`)

export const config = {
  path: '/*',
  method: 'PATCH',
}
