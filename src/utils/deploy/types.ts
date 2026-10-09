import type { NetlifyConfig } from '@netlify/build'
import type { MinimalHeader } from '@netlify/headers-parser'

/**
 * The parts of the resolved configuration a deploy reads and uploads. Satisfied both by the CLI's cached config and
 * by the `NetlifyConfig` that `@netlify/build` hands to the deploy handler.
 */
export interface DeployConfig {
  build: { base: string; publish?: string }
  functions?: NetlifyConfig['functions']
  functionsDirectory?: string
  headers?: NetlifyConfig['headers'] | MinimalHeader[]
  redirects?: unknown[]
}
