import { Config, Context } from 'https://edge.netlify.com'

export default (_, context: Context) => {
  thisWillThrow()
}

export const config: Config = {
  path: '/uncaught-exception',
}
