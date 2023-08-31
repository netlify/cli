export default async (req) => new Response(`With expression path: ${req.url}`)

export const config = {
  path: '/products/:sku',
}
