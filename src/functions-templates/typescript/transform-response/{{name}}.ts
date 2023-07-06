import { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const newURL = new URL(request.url);

  // Look for the query parameter, and return if we don't find it
  if (newURL.searchParams.get("method") !== "transform") {
    return;
  }
  const response = await fetch(newURL);
  const text = await response.text();
  return new Response(text.toUpperCase(), response);
};