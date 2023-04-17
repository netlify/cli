import { IntegrationsConfig } from 'https://edge.netlify.com'
import createEdgeFunction from '../../src/edge-function.ts'

export default createEdgeFunction('integration-iscA')

export const config: IntegrationsConfig = {
  path: '/ordertest',
}
