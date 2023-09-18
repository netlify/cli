export default async (req, context) => new Response(`Deleted item successfully: ${context.params.sku}`)

export const config = {
  path: '/products/:sku',
  method: "DELETE"
}
