export type FrameworkNames = '#static' | '#auto' | '#custom'

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
}

export type BaseServerSettings = {
  dist: string

  // static serving
  useStaticServer?: true

  // Framework specific part
  /** A port where a proxy can listen to it */
  frameworkPort?: number
  functions?: string
  /** The command that was provided for the dev config */
  command?: string
  /** The framework name ('Create React App') */
  framework?: string
  env?: NodeJS.ProcessEnv
  pollingStrategies?: string[]
}

export type ServerSettings = BaseServerSettings & {
  /** default 'secret' */
  jwtSecret: string
  /** default 'app_metadata.authorization.roles' */
  jwtRolePath: string
  /** The port where the functions are running on */
  port: number
  /** The directory of the functions */
  functions: number
}
