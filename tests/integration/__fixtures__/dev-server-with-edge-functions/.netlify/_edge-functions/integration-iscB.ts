import { IntegrationsConfig } from 'https://edge.netlify.com'
import createEdgeFunction from '../../src/edge-function.ts'

export default createEdgeFunction('integration-iscB')

export const config: IntegrationsConfig = {
  path: '/ordertest',
}
