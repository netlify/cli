import { Config } from 'https://edge.netlify.com'
import mod from '@netlify/fake-module'

export default () => {
  const text = mod()

  return new Response(text)
}

export const config: Config = {
  path: '/with-npm-module',
}
