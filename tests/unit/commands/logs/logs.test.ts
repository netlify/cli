import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchDeployHistoricalLogsMock = vi.fn<(...args: unknown[]) => Promise<unknown[]>>()
const findLatestFinishedDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()
const findLatestReadyDeployMock = vi.fn<(...args: unknown[]) => Promise<string | undefined>>()

vi.mock('../../../../src/commands/logs/sources/deploy.js', () => ({
  fetchDeployHistoricalLogs: (...args: unknown[]) => fetchDeployHistoricalLogsMock(...args),
  findCurrentBuildingDeploy: vi.fn(),
  findLatestFinishedDeploy: (...args: unknown[]) => findLatestFinishedDeployMock(...args),
  findLatestReadyDeploy: (...args: unknown[]) => findLatestReadyDeployMock(...args),
  isDeployFinished: () => Promise.resolve(false),
  streamDeploy: vi.fn(),
}))

vi.mock('../../../../src/commands/logs/sources/edge-functions.js', () => ({
  fetchEdgeFunctionHistoricalLogs: () => Promise.resolve([]),
  streamEdgeFunctions: vi.fn(),
}))

const { logsCommand } = await import('../../../../src/commands/logs/logs.js')

const makeCommand = () =>
  ({
    netlify: {
      api: { accessToken: 'token-1' },
      site: { id: 'site-1' },
      siteInfo: {},
    },
  }) as never

beforeEach(() => {
  fetchDeployHistoricalLogsMock.mockReset().mockResolvedValue([])
  findLatestFinishedDeployMock.mockReset().mockResolvedValue('finished-deploy')
  findLatestReadyDeployMock.mockReset().mockResolvedValue('ready-deploy')
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
