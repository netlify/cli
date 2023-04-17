import { Context } from 'https://edge.netlify.com'

export default (name: string) => async (_request: Request, context: Context) => {
  const response = await context.next()
  const content = await response.text()

  return new Response(`${name}|${String(content).trim()}`, response)
}
