import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  context.log("Hello from the logging service");

  return new Response("The request to this URL was logged", {
    headers: { "content-type": "text/html" },
  });
};