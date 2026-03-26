import process from 'process'

import type BaseCommand from '../base-command.js'

const readStdin = (): Promise<string> =>
  new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data)
    })
    // If stdin isn't being piped, resolve after a short timeout
    if (process.stdin.isTTY) {
      resolve(data)
    }
  })

export const gitCredentials = async (command: BaseCommand) => {
  const input = await readStdin()

  // Only respond to "get" requests from the git credential protocol
  if (!input.includes('protocol=') && !input.startsWith('get')) {
    return
  }

  const token = command.netlify.api.accessToken
  if (!token) {
    throw new Error('No access token found. Please run `netlify login` first.')
  }

  // Output in git credential helper format
  process.stdout.write(`username=x-access-token\npassword=${token}\n`)
}
