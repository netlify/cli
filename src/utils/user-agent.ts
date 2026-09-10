import os from 'os'
import process from 'process'

import WSL from 'is-wsl'

import { getDrivingAgent } from './agent-detection.js'
import getCLIPackageJson from './get-cli-package-json.js'

const platform = WSL ? 'wsl' : os.platform()
const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

const { name, version } = await getCLIPackageJson()

export const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`

export const getRequestUserAgent = (env: NodeJS.ProcessEnv = process.env): string => {
  const agent = getDrivingAgent(env)
  return agent ? `${USER_AGENT} agent/${agent.name}` : USER_AGENT
}
