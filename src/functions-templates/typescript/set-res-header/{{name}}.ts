import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const newURL = new URL("/sale", request.url);
  const res = await fetch(newURL);
  res.headers.set("X-Your-Custom-Header", "A custom value");
  return res;
};