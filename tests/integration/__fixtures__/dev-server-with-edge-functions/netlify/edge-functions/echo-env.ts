import { Config, Context } from 'https://edge.netlify.com'

export default (_, context: Context) => Response.json(Netlify.env.toObject())

export const config: Config = {
  path: '/echo-env',
}
