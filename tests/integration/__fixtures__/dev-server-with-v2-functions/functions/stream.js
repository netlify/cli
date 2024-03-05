export default async () =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue('first chunk')
        setTimeout(() => {
          controller.enqueue('second chunk')
          controller.close()
        }, 200)
      },
    }),
    {
      status: 200,
    },
  )
