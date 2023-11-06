// Learn more about streaming function responses here:
// TODO: Get bit.ly link for https://docs.netlify.com/functions/get-started/?fn-language=ts#synchronous-function

export default async () => {
    const encoder = new TextEncoder();
    const formatter = new Intl.DateTimeFormat("en", { timeStyle: "medium" });
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("<html><body><ol>"));
        let i = 0;
        const timer = setInterval(() => {
          controller.enqueue(
            encoder.encode(
              `<li>Hello at ${formatter.format(new Date())}</li>\n\n`
            )
          );
          if (i++ >= 5) {
            controller.enqueue(encoder.encode("</ol></body></html>"));
            controller.close();
            clearInterval(timer);
          }
        }, 1000);
      }
    });

    return new Response(body);
  };