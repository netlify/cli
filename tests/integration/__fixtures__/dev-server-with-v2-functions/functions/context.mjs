export default async (_request, context) =>
  new Response(
    JSON.stringify({
      ...context,
      cookies: { foo: context.cookies.get('foo') },
    }),
    {
      status: 200,
    },
  )
