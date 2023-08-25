import { Config, Context } from 'https://edge.netlify.com'

export default (_, context: Context) => Response.json(context)

export const config: Config = {
  path: '/categories/:category/products/:product',
}
