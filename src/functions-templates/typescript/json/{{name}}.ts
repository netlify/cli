import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  return context.json({ hello: "world" });
};