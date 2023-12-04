import { NetlifyConfig } from '@netlify/build'

import StateConfig from '../../utils/state-config.js'

interface Config extends NetlifyConfig {
  functionsDirectory?: string
}

export interface UIContext {
  config: Config
  projectDir: string
  api: any
  state: StateConfig
  siteInfo: any
  globalConfig: Awaited<ReturnType<typeof import('../../utils/get-global-config.js')['default']>>
  site: any
}
