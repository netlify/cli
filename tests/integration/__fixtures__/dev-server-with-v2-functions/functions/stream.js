export default async () =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue('first chunk')
        setTimeout(() => {
          controller.enqueue('second chunk')
          controller.close()
        }, 50)
      },
    }),
    {
      status: 200,
    },
  )
