import { Context, Request } from "@netlify/functions"

export default async (context: Context, req: Request) => {
  const { name = 'stranger' } = req.queryStringParameters

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${name}!`,
    }),
  }
}
