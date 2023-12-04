import { NetlifyConfig } from '@netlify/build'

interface Config extends NetlifyConfig {
  functionsDirectory?: string
}

export interface UIContext {
  config: Config
  projectDir: string
}
