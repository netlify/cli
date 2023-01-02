import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  return Response.json({ hello: "world", location: context.geo.city });
};