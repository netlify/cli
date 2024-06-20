export default async (req, context) => new Response(`Your product: ${context.params.sku}`)

export const config = {
  path: '/custom-path-excluded/:sku',
  excludedPath: ['/custom-path-excluded/jacket'],
}
