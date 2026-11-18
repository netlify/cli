import { afterEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createDeployCommand } from '../../../../src/commands/deploy/index.js'

const parseDeploy = (args: string[]) => {
  const deploy = createDeployCommand(new BaseCommand('netlify'))
  deploy.parseOptions(args)
  return deploy
}

describe('deploy context', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test.each([
    { args: [], expected: 'dev' },
    { args: ['--draft'], expected: 'dev' },
    { args: ['--prod'], expected: 'production' },
    { args: ['--prod-if-unlocked'], expected: 'production' },
    { args: ['--prod', '--context', 'deploy-preview'], expected: 'deploy-preview' },
    { args: ['--prod', '--context', 'dev'], expected: 'dev' },
  ])('$args resolves to $expected', ({ args, expected }) => {
    vi.stubEnv('CONTEXT', '')

    expect(parseDeploy(args).getContext()).toBe(expected)
  })

  test('the CONTEXT env var wins over --prod', () => {
    vi.stubEnv('CONTEXT', 'branch-deploy')

    expect(parseDeploy(['--prod']).getContext()).toBe('branch-deploy')
  })

  test('--context wins over the CONTEXT env var', () => {
    vi.stubEnv('CONTEXT', 'branch-deploy')

    expect(parseDeploy(['--prod', '--context', 'deploy-preview']).getContext()).toBe('deploy-preview')
  })
})
