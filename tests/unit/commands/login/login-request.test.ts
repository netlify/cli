import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createTicket: vi.fn().mockResolvedValue({ id: 'test-ticket-123' }),
}))

vi.mock('@netlify/api', () => ({
  NetlifyAPI: vi.fn().mockImplementation(() => ({
    createTicket: mocks.createTicket,
  })),
}))

import { loginRequest } from '../../../../src/commands/login/login-request.js'

describe('loginRequest', () => {
  let stdoutOutput: string[]
  const originalEnv = { ...process.env }
  const originalWrite = process.stdout.write.bind(process.stdout)

  beforeEach(() => {
    stdoutOutput = []
    process.stdout.write = vi.fn((chunk: string) => {
      stdoutOutput.push(chunk)
      return true
    }) as typeof process.stdout.write
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    process.stdout.write = originalWrite
  })

  test('outputs ticket info as plain text', async () => {
    await loginRequest()

    const output = stdoutOutput.join('')
    expect(output).toContain('Ticket ID: test-ticket-123')
    expect(output).toContain(
      'Authorize URL: https://app.netlify.com/authorize?response_type=ticket&ticket=test-ticket-123',
    )
    expect(output).toContain('netlify login --check test-ticket-123')
  })

  test('uses custom NETLIFY_WEB_UI when set', async () => {
    process.env.NETLIFY_WEB_UI = 'https://custom.netlify.com'

    await loginRequest()

    const output = stdoutOutput.join('')
    expect(output).toContain('https://custom.netlify.com/authorize?response_type=ticket&ticket=test-ticket-123')
  })
})
