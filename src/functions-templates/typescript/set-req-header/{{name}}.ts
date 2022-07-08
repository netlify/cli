import type { Context } from "netlify:edge";

export default async (request: Request, context: Context) => {
  request.headers.set("X-Your-Custom-Header", "Your custom header value");
};