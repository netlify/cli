import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchDeployHistoricalLogsMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>()
const findLatestFinishedDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()
const findLatestReadyDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()
const streamDeployMock = vi.fn<(...args: unknown[]) => void>()
const findCurrentBuildingDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()
const isDeployFinishedMock = vi.fn<(...args: unknown[]) => Promise<boolean>>()
const fetchFunctionHistoricalLogsMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>()
const fetchEdgeFunctionHistoricalLogsMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>()

vi.mock('../../../../src/commands/logs/sources/functions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/commands/logs/sources/functions.js')>()
  return {
    ...actual,
    listFunctions: () => Promise.resolve([{ n: 'test-function' }]),
    fetchFunctionHistoricalLogs: (...args: unknown[]) => fetchFunctionHistoricalLogsMock(...args),
  }
})

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
  fetchEdgeFunctionHistoricalLogs: (...args: unknown[]) => fetchEdgeFunctionHistoricalLogsMock(...args),
  streamEdgeFunctions: vi.fn(),
}))

const fetchServerHistoricalLogsMock =
  vi.fn<(...args: unknown[]) => Promise<{ entries: unknown[]; truncated: boolean }>>()
const streamServerMock = vi.fn<(...args: unknown[]) => void>()

vi.mock('../../../../src/commands/logs/sources/server.js', () => ({
  fetchServerHistoricalLogs: (...args: unknown[]) => fetchServerHistoricalLogsMock(...args),
  streamServer: (...args: unknown[]) => {
    streamServerMock(...args)
  },
}))

const { logsCommand, runFollowMode } = await import('../../../../src/commands/logs/logs.js')

const A_VALID_DEPLOY_ID = 'a'.repeat(24)

const API_BASE = 'https://api.example.test/api/v1'

const makeCommand = () =>
  ({
    netlify: {
      api: { accessToken: 'token-1', basePath: API_BASE },
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
  fetchFunctionHistoricalLogsMock.mockReset().mockResolvedValue([])
  fetchEdgeFunctionHistoricalLogsMock.mockReset().mockResolvedValue([])
  fetchServerHistoricalLogsMock.mockReset().mockResolvedValue({ entries: [], truncated: false })
  streamServerMock.mockClear()
})

describe('logsCommand large histories', () => {
  it.each(['functions', 'edge-functions'])('prints a large %s history without changing entry order', async (source) => {
    const visibleIndices = [0, 500_000, 999_999]
    const hiddenEntry = {
      source: source === 'functions' ? 'function' : 'edge-function',
      name: 'test-function',
      ts: 1,
      level: 'DEBUG',
      message: 'hidden',
    }
    const entries = Array<typeof hiddenEntry>(1_000_000).fill(hiddenEntry)
    for (const index of visibleIndices) {
      entries[index] = { ...hiddenEntry, level: 'INFO', message: `entry-${index.toString()}` }
    }
    const fetchLogs = source === 'functions' ? fetchFunctionHistoricalLogsMock : fetchEdgeFunctionHistoricalLogsMock
    fetchLogs.mockResolvedValueOnce(entries)
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    try {
      await logsCommand({ source: [source], since: '1h', level: ['info'], json: true }, makeCommand())

      expect(output.mock.calls.map(([line]) => (JSON.parse(line.toString()) as { message: string }).message)).toEqual(
        visibleIndices.map((index) => `entry-${index.toString()}`),
      )
    } finally {
      output.mockRestore()
    }
  })
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

describe('logsCommand --source server', () => {
  it('fetches the server logs for the --since window', async () => {
    const oneHourMs = 60 * 60 * 1000
    const before = Date.now()

    await logsCommand({ source: ['server'], since: '1h' }, makeCommand())

    expect(fetchServerHistoricalLogsMock).toHaveBeenCalledOnce()
    const args = fetchServerHistoricalLogsMock.mock.calls[0]?.[0] as { from: number; to: number }
    expect(args).toMatchObject({ apiBase: API_BASE, siteId: 'site-1', accessToken: 'token-1' })
    expect(args.to - args.from).toBe(oneHourMs)
    expect(args.to).toBeGreaterThanOrEqual(before)
  })

  it.each([
    ['--deploy-id', { deployId: A_VALID_DEPLOY_ID }],
    ['--url', { url: 'https://example.netlify.app' }],
  ])('rejects %s, which server logs cannot be filtered by', async (_flag, deployOptions) => {
    await expect(
      logsCommand({ source: ['functions', 'server'], since: '1h', ...deployOptions }, makeCommand()),
    ).rejects.toThrow('Server logs cannot be filtered by deploy')
    expect(fetchServerHistoricalLogsMock).not.toHaveBeenCalled()
  })

  it('passes the --level levels to the server source', async () => {
    await logsCommand({ source: ['server'], since: '1h', level: ['error'] }, makeCommand())

    expect(fetchServerHistoricalLogsMock.mock.calls[0]?.[0]).toMatchObject({ levels: ['error'] })
  })

  it('does not look up a deploy for server logs alone', async () => {
    await logsCommand({ source: ['server'], since: '1h' }, makeCommand())

    expect(findLatestReadyDeployMock).not.toHaveBeenCalled()
    expect(findLatestFinishedDeployMock).not.toHaveBeenCalled()
  })

  it('streams the server logs in follow mode', async () => {
    await runFollowMode(
      followArgs({ sources: ['server'], client: { basePath: API_BASE } as never, levelsToPrint: ['warn'] }),
    )

    expect(streamServerMock).toHaveBeenCalledOnce()
    expect(streamServerMock.mock.calls[0]?.[0]).toMatchObject({
      apiBase: API_BASE,
      siteId: 'site-1',
      accessToken: 'token-1',
      levels: ['warn'],
    })
  })
})
