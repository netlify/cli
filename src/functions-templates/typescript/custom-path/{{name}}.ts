import { Config, Context } from "@netlify/functions"

export default async (req: Request, context: Context) => {
  return new Response(`Your IP is ${context.ip}`)
}

export const config: Config = {
  path: "/whatismyip"
}
