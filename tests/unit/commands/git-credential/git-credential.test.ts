import { Readable, Writable } from 'stream'
import { describe, expect, it } from 'vitest'

import {
  parseGitCredentialInput,
  writeCredentials,
  NETLIFY_GIT_HOST,
} from '../../../../src/commands/git-credential/git-credential.js'

describe('git-credential command', () => {
  describe('parseGitCredentialInput', () => {
    it('parses git credential input format', async () => {
      const input = new Readable({
        read() {
          this.push('protocol=https\n')
          this.push('host=git.netlify.app\n')
          this.push('path=/test/repo.git\n')
          this.push('\n')
          this.push(null)
        },
      })

      const result = await parseGitCredentialInput(input)

      expect(result).toEqual({
        protocol: 'https',
        host: 'git.netlify.app',
        path: '/test/repo.git',
      })
    })

    it('handles values with equals signs', async () => {
      const input = new Readable({
        read() {
          this.push('protocol=https\n')
          this.push('host=example.com\n')
          this.push('username=test=user\n')
          this.push('\n')
          this.push(null)
        },
      })

      const result = await parseGitCredentialInput(input)

      expect(result.username).toBe('test=user')
    })

    it('stops at empty line', async () => {
      const input = new Readable({
        read() {
          this.push('protocol=https\n')
          this.push('\n')
          this.push('host=should-not-be-included\n')
          this.push(null)
        },
      })

      const result = await parseGitCredentialInput(input)

      expect(result).toEqual({
        protocol: 'https',
      })
      expect(result.host).toBeUndefined()
    })
  })

  describe('writeCredentials', () => {
    it('writes credentials in git credential format', () => {
      const output: string[] = []
      const mockOutput = new Writable({
        write(chunk, encoding, callback) {
          output.push(chunk.toString())
          callback()
        },
      })

      writeCredentials(mockOutput, 'my-test-token')

      expect(output.join('')).toBe('username=x-access-token\npassword=my-test-token\n')
    })
  })

  describe('NETLIFY_GIT_HOST', () => {
    it('is the correct host', () => {
      expect(NETLIFY_GIT_HOST).toBe('git.netlify.app')
    })
  })
})
