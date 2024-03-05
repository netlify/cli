export default async (req, context) => new Response(`With expression path: ${JSON.stringify(context.params)}`)

export const config = {
  path: '/products/:sku',
  preferStatic: true,
}
