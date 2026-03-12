import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showTicket: vi.fn(),
  exchangeTicket: vi.fn(),
  getCurrentUser: vi.fn(),
  globalConfigGet: vi.fn().mockReturnValue({}),
  globalConfigSet: vi.fn(),
}))

vi.mock('@netlify/api', () => ({
  NetlifyAPI: vi.fn().mockImplementation(() => ({
    showTicket: mocks.showTicket,
    exchangeTicket: mocks.exchangeTicket,
    getCurrentUser: mocks.getCurrentUser,
    set accessToken(_val: string) {
      // no-op for test
    },
  })),
}))

import type { GlobalConfigStore } from '@netlify/dev-utils'

import { loginCheck } from '../../../../src/commands/login/login-check.js'

const apiOpts = { userAgent: 'test-agent' }
const globalConfig = { get: mocks.globalConfigGet, set: mocks.globalConfigSet } as unknown as GlobalConfigStore

describe('loginCheck', () => {
  let stdoutOutput: string[]
  const originalWrite = process.stdout.write.bind(process.stdout)

  beforeEach(() => {
    stdoutOutput = []
    process.stdout.write = vi.fn((chunk: string) => {
      stdoutOutput.push(chunk)
      return true
    }) as typeof process.stdout.write
  })

  afterEach(() => {
    process.stdout.write = originalWrite
  })

  test('outputs pending when ticket is not authorized', async () => {
    mocks.showTicket.mockResolvedValue({ authorized: false })

    await loginCheck({ check: 'ticket-abc' }, apiOpts, globalConfig)

    const output = stdoutOutput.join('')
    expect(output).toContain('Status: pending')
  })

  test('outputs denied when showTicket returns 404', async () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 })
    mocks.showTicket.mockRejectedValue(error)

    await loginCheck({ check: 'ticket-bad' }, apiOpts, globalConfig)

    const output = stdoutOutput.join('')
    expect(output).toContain('Status: denied')
  })

  test('outputs denied when showTicket returns 401', async () => {
    const error = Object.assign(new Error('Unauthorized'), { status: 401 })
    mocks.showTicket.mockRejectedValue(error)

    await loginCheck({ check: 'ticket-bad' }, apiOpts, globalConfig)

    const output = stdoutOutput.join('')
    expect(output).toContain('Status: denied')
  })

  test('rethrows non-auth errors from showTicket', async () => {
    const error = Object.assign(new Error('Internal Server Error'), { status: 500 })
    mocks.showTicket.mockRejectedValue(error)

    await expect(loginCheck({ check: 'ticket-bad' }, apiOpts, globalConfig)).rejects.toThrow('Internal Server Error')
  })

  test('rethrows errors without a status from showTicket', async () => {
    mocks.showTicket.mockRejectedValue(new Error('Network failure'))

    await expect(loginCheck({ check: 'ticket-bad' }, apiOpts, globalConfig)).rejects.toThrow('Network failure')
  })

  test('outputs authorized and stores token when ticket is authorized', async () => {
    mocks.showTicket.mockResolvedValue({ authorized: true })
    mocks.exchangeTicket.mockResolvedValue({ access_token: 'test-token-xyz' })
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      full_name: 'Test User',
    })

    await loginCheck({ check: 'ticket-ok' }, apiOpts, globalConfig)

    const output = stdoutOutput.join('')
    expect(output).toContain('Status: authorized')
    expect(output).toContain('Name: Test User')
    expect(output).toContain('Email: test@example.com')

    expect(mocks.globalConfigSet).toHaveBeenCalledWith('userId', 'user-1')
    expect(mocks.globalConfigSet).toHaveBeenCalledWith(
      'users.user-1',
      expect.objectContaining({
        id: 'user-1',
        email: 'test@example.com',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        auth: expect.objectContaining({ token: 'test-token-xyz' }),
      }),
    )
  })
})
