import type { FrameworkNames } from '../../utils/types';

export type DevConfig = {
  framework: FrameworkNames
  /** Directory of the functions */
  functions: string
  publish: string
  /** Port to serve the functions */
  port: number
  live: boolean
  staticServerPort?: number
  targetPort?: number
  /** Command to run */
  command?: string
  functionsPort?: number
  autoLaunch?: boolean
  https?: {
    keyFile: string
    certFile: string
  },
  envFiles?:string[]
}
