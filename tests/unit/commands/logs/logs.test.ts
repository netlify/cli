import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchDeployHistoricalLogsMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>()
const findLatestFinishedDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()
const findLatestReadyDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()
const streamDeployMock = vi.fn<(...args: unknown[]) => void>()
const findCurrentBuildingDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()
const isDeployFinishedMock = vi.fn<(...args: unknown[]) => Promise<boolean>>()

vi.mock('../../../../src/commands/logs/sources/deploy.js', () => ({
  fetchDeployHistoricalLogs: (...args: unknown[]) => fetchDeployHistoricalLogsMock(...args),
  findCurrentBuildingDeploy: (...args: unknown[]) => findCurrentBuildingDeployMock(...args),
  findLatestFinishedDeploy: (...args: unknown[]) => findLatestFinishedDeployMock(...args),
  findLatestReadyDeploy: (...args: unknown[]) => findLatestReadyDeployMock(...args),
  isDeployFinished: (...args: unknown[]) => isDeployFinishedMock(...args),
  streamDeploy: (...args: unknown[]) => {
    streamDeployMock(...args)
  },
}))

vi.mock('../../../../src/commands/logs/sources/edge-functions.js', () => ({
  fetchEdgeFunctionHistoricalLogs: () => Promise.resolve([]),
  streamEdgeFunctions: vi.fn(),
}))

const { logsCommand, runFollowMode } = await import('../../../../src/commands/logs/logs.js')

const A_VALID_DEPLOY_ID = 'a'.repeat(24)

const makeCommand = () =>
  ({
    netlify: {
      api: { accessToken: 'token-1' },
      site: { id: 'site-1' },
      siteInfo: {},
    },
  }) as never

type FollowArgs = Parameters<typeof runFollowMode>[0]

const followArgs = (overrides: Partial<FollowArgs>): FollowArgs => ({
  sources: ['deploy'],
  client: {} as never,
  siteId: 'site-1',
  accessToken: 'token-1',
  deployTargeted: false,
  functionNames: [],
  edgeFunctionNames: [],
  levelsToPrint: ['info', 'warn', 'error', 'debug', 'trace', 'fatal'],
  json: false,
  ...overrides,
})

beforeEach(() => {
  fetchDeployHistoricalLogsMock.mockReset().mockResolvedValue([])
  findLatestFinishedDeployMock.mockReset().mockResolvedValue('finished-deploy')
  findLatestReadyDeployMock.mockReset().mockResolvedValue('ready-deploy')
  streamDeployMock.mockClear()
  findCurrentBuildingDeployMock.mockReset().mockResolvedValue('building-deploy')
  isDeployFinishedMock.mockReset().mockResolvedValue(false)
})

describe('logsCommand deploy auto-selection', () => {
  it('auto-selects the latest finished deploy for --source deploy', async () => {
    await logsCommand({ source: ['deploy'], since: '1h' }, makeCommand())

    expect(findLatestFinishedDeployMock).toHaveBeenCalledOnce()
    expect(findLatestReadyDeployMock).not.toHaveBeenCalled()
    expect(fetchDeployHistoricalLogsMock.mock.calls[0]?.[0]).toMatchObject({ deployId: 'finished-deploy' })
  })

  it('auto-selects the latest ready deploy for non-deploy sources', async () => {
    await logsCommand({ source: ['edge-functions'], since: '1h' }, makeCommand())

    expect(findLatestReadyDeployMock).toHaveBeenCalledOnce()
    expect(findLatestFinishedDeployMock).not.toHaveBeenCalled()
  })

  it('does not fetch deploy logs when there is no finished deploy', async () => {
    findLatestFinishedDeployMock.mockResolvedValue(undefined)

    await logsCommand({ source: ['deploy'], since: '1h' }, makeCommand())

    expect(findLatestFinishedDeployMock).toHaveBeenCalledOnce()
    expect(fetchDeployHistoricalLogsMock).not.toHaveBeenCalled()
  })
})

describe('logsCommand --deploy-id', () => {
  it('rejects an invalid deploy id', async () => {
    await expect(logsCommand({ source: ['deploy'], deployId: 'not-a-deploy-id' }, makeCommand())).rejects.toThrow(
      'Invalid --deploy-id value: not-a-deploy-id. Expected a deploy ID.',
    )
  })

  it('rejects --deploy-id combined with --url', async () => {
    await expect(
      logsCommand(
        { source: ['deploy'], deployId: A_VALID_DEPLOY_ID, url: 'https://example.netlify.app' },
        makeCommand(),
      ),
    ).rejects.toThrow('--deploy-id cannot be used together with --url.')
  })

  it('fetches historical logs for the given deploy id', async () => {
    await logsCommand({ source: ['deploy'], deployId: A_VALID_DEPLOY_ID, since: '1h' }, makeCommand())

    expect(fetchDeployHistoricalLogsMock).toHaveBeenCalledTimes(1)
    expect(fetchDeployHistoricalLogsMock.mock.calls[0]?.[0]).toMatchObject({ deployId: A_VALID_DEPLOY_ID })
  })
})

describe('runFollowMode deploy targeting', () => {
  it('streams the explicitly targeted deploy without looking up the building deploy', async () => {
    await runFollowMode(followArgs({ deployId: 'target-deploy', deployTargeted: true }))

    expect(findCurrentBuildingDeployMock).not.toHaveBeenCalled()
    expect(streamDeployMock).toHaveBeenCalledTimes(1)
    expect(streamDeployMock.mock.calls[0]?.[1]).toBe('target-deploy')
  })

  it('falls back to the current building deploy when nothing is targeted', async () => {
    await runFollowMode(followArgs({ deployId: 'latest-deploy', deployTargeted: false }))

    expect(findCurrentBuildingDeployMock).toHaveBeenCalledOnce()
    expect(streamDeployMock).toHaveBeenCalledTimes(1)
    expect(streamDeployMock.mock.calls[0]?.[1]).toBe('building-deploy')
  })

  it('streams nothing when no deploy is building and none is targeted', async () => {
    findCurrentBuildingDeployMock.mockResolvedValue(undefined)

    await runFollowMode(followArgs({ deployId: undefined, deployTargeted: false }))

    expect(streamDeployMock).not.toHaveBeenCalled()
  })

  it('still streams the targeted deploy when the completion check fails', async () => {
    isDeployFinishedMock.mockRejectedValue(new Error('api down'))

    await runFollowMode(followArgs({ deployId: 'target-deploy', deployTargeted: true }))

    expect(streamDeployMock).toHaveBeenCalledTimes(1)
    expect(streamDeployMock.mock.calls[0]?.[1]).toBe('target-deploy')
  })
})
