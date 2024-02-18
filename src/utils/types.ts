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
  /** The host where the dev server is running on */
  host?: string
  /** The port where the dev server is running on */
  port: number
  /** The port where the functions are running on */
  functionsPort: number
  https?: { key: string; cert: string; keyFilePath: string; certFilePath: string }
  clearPublishDirectory?: boolean
}
