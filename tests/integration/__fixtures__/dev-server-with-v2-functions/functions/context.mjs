export default async (_request, context) =>
  new Response(`${JSON.stringify(context)}`, {
    status: 200,
  })
