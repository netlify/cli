import { Buffer } from 'buffer'
import { IncomingMessage } from 'http'

import { Match } from 'netlify-redirector'

export type FrameworkNames = '#static' | '#auto' | '#custom' | string

export type FrameworkInfo = {
  build: {
    directory: string
  }
  dev: {
    commands: string[]
    port: number
    pollingStrategies: { name: string }[]
  }
  name: FrameworkNames
  staticAssetsDirectory: string
  env: NodeJS.ProcessEnv
  plugins?: string[]
}

export type BaseServerSettings = {
  baseDirectory?: string
  dist?: string
  /** The command that was provided for the dev config */
  command?: string
  /** If it should be served like static files */
  useStaticServer?: boolean

  /** A port where a proxy can listen to it */
  frameworkPort?: number
  /** The host where a proxy can listen to it */
  frameworkHost?: '127.0.0.1' | '::1'
  functions?: string
  /** The framework name ('Create React App') */
  framework?: string
  env?: NodeJS.ProcessEnv
  pollingStrategies?: string[]
  plugins?: string[]
  clearPublishDirectory?: boolean
}

export type ServerSettings = BaseServerSettings & {
  /** default 'secret' */
  jwtSecret: string
  /** default 'app_metadata.authorization.roles' */
  jwtRolePath: string
  /** The port where the dev server is running on */
  port: number
  /** The port where the functions are running on */
  functionsPort: number
  https?: { key: string; cert: string; keyFilePath: string; certFilePath: string }
  clearPublishDirectory?: boolean
  skipWaitPort?: boolean
}

export interface Request extends IncomingMessage {
  originalBody?: Buffer | null
  protocol?: string
  hostname?: string
}

export type Rewriter = (req: Request) => Match | null

export interface Account {
  id: string
  name: string
  slug: string
  type: string
  capabilities: {
    sites: {
      included: number
      used: number
    }
    collaborators: {
      included: number
      used: number
    }
  }
  billing_name: string
  billing_email: string
  billing_details: string
  billing_period: string
  payment_method_id: string
  type_name: string
  type_id: string
  owner_ids: string[]
  roles_allowed: string[]
  created_at: string
  updated_at: string
}

export interface RepoFromGithub {
  name: string
  html_url: string
  full_name: string
  archived: boolean
  disabled: boolean
}

export interface Template {
  name: string
  sourceCodeUrl: string
  slug: string
}
