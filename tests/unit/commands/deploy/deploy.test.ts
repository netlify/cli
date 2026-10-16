import { beforeEach, describe, expect, test, vi } from 'vitest'

const { mockRunBuild, mockCreateSiteDeploy, mockCancelSiteDeploy } = vi.hoisted(() => ({
  mockRunBuild: vi.fn(),
  mockCreateSiteDeploy: vi.fn(),
  mockCancelSiteDeploy: vi.fn(),
}))

vi.mock('../../../../src/lib/build.js', async () => ({
  ...(await vi.importActual('../../../../src/lib/build.js')),
  getRunBuildOptions: vi.fn().mockResolvedValue({}),
  runBuild: (...args: unknown[]) => mockRunBuild(...args) as unknown,
}))

vi.mock('../../../../src/utils/build-info.js', () => ({
  detectFrameworkSettings: vi.fn().mockResolvedValue(undefined),
  getDefaultConfig: vi.fn().mockReturnValue({}),
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  getToken: vi.fn().mockResolvedValue(['fake-token', 'flag']),
  log: vi.fn(),
  logJson: vi.fn(),
  warn: vi.fn(),
  logAndThrowError: (message: unknown): never => {
    throw message instanceof Error ? message : new Error(String(message))
  },
}))

import { deploy } from '../../../../src/commands/deploy/deploy.js'

const createMockCommand = () =>
  ({
    workingDir: '/project',
    workspacePackage: undefined,
    setAnalyticsPayload: vi.fn(),
    authenticate: vi.fn().mockResolvedValue('fake-token'),
    netlify: {
      api: {
        createSiteDeploy: (...args: unknown[]) => mockCreateSiteDeploy(...args) as unknown,
        cancelSiteDeploy: (...args: unknown[]) => mockCancelSiteDeploy(...args) as unknown,
      },
      cachedConfig: {},
      config: {},
      site: { id: 'site-1', root: '/project' },
      siteInfo: { id: 'site-1', name: 'my-site', url: 'https://my-site.netlify.app' },
    },
  }) as unknown as Parameters<typeof deploy>[1]

describe('deploy --build', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateSiteDeploy.mockResolvedValue({ id: 'deploy-1' })
    mockCancelSiteDeploy.mockResolvedValue(undefined)
  })

  test('fails and cancels the created deploy when the build never runs the deploy step', async () => {
    mockRunBuild.mockResolvedValue({ exitCode: 0, newConfig: {}, configMutations: [] })

    const options = {
      build: true,
      draft: true,
      json: false,
      open: false,
      prod: false,
      prodIfUnlocked: false,
      skipFunctionsCache: false,
    }

    await expect(deploy(options, createMockCommand())).rejects.toThrow(
      'The build completed without running the deploy step',
    )

    expect(mockCancelSiteDeploy).toHaveBeenCalledWith({ deploy_id: 'deploy-1' })
  })
})
