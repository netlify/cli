import { Config } from 'https://edge.netlify.com'
import createEdgeFunction from '../../src/edge-function.ts'

export default createEdgeFunction('user-iscA')

export const config: Config = {
  path: '/ordertest',
}
