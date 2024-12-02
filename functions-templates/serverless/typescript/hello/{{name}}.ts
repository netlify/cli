import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  console.log("Hello! you can find me at path /function")
  return new Response("Hello, world!")
}

export const config:Config = {
  path: "/function"
}