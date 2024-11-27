import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  return new Response("Hello, World!", {
    headers: { "content-type": "text/html" },
  });
};
