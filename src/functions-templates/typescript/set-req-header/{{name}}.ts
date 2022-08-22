import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  request.headers.set("X-Your-Custom-Header", "Your custom header value");
};