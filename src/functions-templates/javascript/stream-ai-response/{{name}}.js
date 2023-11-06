// Learn more about streaming function responses here:
// TODO: Get bit.ly link for https://docs.netlify.com/functions/get-started/?fn-language=ts#synchronous-function

export default async () => {
  // Get the request from the request query string, or use a default
  const pie =
    event.queryStringParameters?.pie ??
    "something inspired by a springtime garden";

  // The response body returned from "fetch" is a "ReadableStream",
  // so you can return it directly in your streaming response
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Set this environment variable to your own key
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a baker. The user will ask you for a pie recipe. You will respond with the recipe. Use markdown to format your response"
        },
        // Use "slice" to limit the length of the input to 500 characters
        { role: "user", content: pie.slice(0, 500) }
      ],
      // Use server-sent events to stream the response
      stream: true
    })
  });

  return new Response(body, {
    headers: {
      // This is the mimetype for server-sent events
      "content-type": "text/event-stream"
    }
  });
};