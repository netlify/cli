import process from 'process'
import readline from 'readline'
import type { Readable, Writable } from 'stream'

import { getToken } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'
import type { GitCredentialOptionValues } from './option_values.js'

export const AGENTGIT_HOST = 'agentgit.netlify.app'

export const parseGitCredentialInput = async (input: Readable): Promise<Record<string, string>> => {
  const rl = readline.createInterface({
    input,
    terminal: false,
  })

  const data: Record<string, string> = {}

  for await (const line of rl) {
    if (line === '') break
    const [key, ...valueParts] = line.split('=')
    if (key) {
      data[key] = valueParts.join('=')
    }
  }

  return data
}

export const writeCredentials = (output: Writable, token: string): void => {
  output.write(`username=x-access-token\n`)
  output.write(`password=${token}\n`)
}

export const gitCredential = async (
  operation: string,
  _options: GitCredentialOptionValues,
  _command: BaseCommand,
): Promise<void> => {
  if (operation !== 'get') {
    return
  }

  const input = await parseGitCredentialInput(process.stdin)

  if (input.host !== AGENTGIT_HOST) {
    return
  }

  const [token] = await getToken()

  if (!token) {
    return
  }

  writeCredentials(process.stdout, token)
}
