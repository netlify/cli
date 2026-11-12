import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import type { NormalizedCachedConfigConfig } from '../../../src/utils/command-helpers.js'
import { createRewriter, getWatchers } from '../../../src/utils/rules-proxy.js'
import type { Request } from '../../../src/utils/types.js'

const stubMatcher = { match: () => null, parseErrors: [], rulesCount: 1, close: () => {} }

const { createMatcher } = vi.hoisted(() => ({
  createMatcher: vi.fn(async (_rules: { to?: string }[]) => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    return stubMatcher
  }),
}))

vi.mock('@netlify/redirect-matcher', () => ({ createMatcher }))

describe('createRewriter matcher lifecycle', () => {
  const directories: string[] = []
  const request = { url: '/old', headers: { host: 'localhost:8888' } } as unknown as Request

  const rewriterFor = async (redirectsFile: string) => {
    const projectDir = await mkdtemp(join(tmpdir(), 'rules-proxy-matcher-'))
    directories.push(projectDir)
    await writeFile(join(projectDir, '_redirects'), redirectsFile)
    const rewriter = await createRewriter({
      config: { redirects: [] } as unknown as NormalizedCachedConfigConfig,
      jwtRoleClaim: '',
      jwtSecret: '',
      projectDir,
    })
    return { projectDir, rewriter }
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    createMatcher.mockClear()
    await Promise.all(
      getWatchers()
        .splice(0)
        .map((watcher) => watcher.close()),
    )
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
  })

  test('concurrent first requests share one matcher', async () => {
    const { rewriter } = await rewriterFor('/old /new 301\n')

    await Promise.all([rewriter(request), rewriter(request), rewriter(request)])

    expect(createMatcher).toHaveBeenCalledTimes(1)
  })

  test('a failed build is retried by the next request', async () => {
    createMatcher.mockRejectedValueOnce(new Error('failed to load matcher'))
    const { rewriter } = await rewriterFor('/old /new 301\n')

    await expect(rewriter(request)).rejects.toThrow('failed to load matcher')
    await expect(rewriter(request)).resolves.toBeNull()

    expect(createMatcher).toHaveBeenCalledTimes(2)
  })

  test('a reload during the first build does not leave the old rules cached', async () => {
    let finishFirstBuild = () => {}
    createMatcher.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finishFirstBuild = resolve
      })
      return stubMatcher
    })
    const reloaded = vi.fn()
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes('Reloading redirect rules')) reloaded()
    })
    const { projectDir, rewriter } = await rewriterFor('/old /new 301\n')

    const firstRequest = rewriter(request)
    await writeFile(join(projectDir, '_redirects'), '/old /newer 301\n')
    await vi.waitFor(
      () => {
        expect(reloaded).toHaveBeenCalled()
      },
      { timeout: 5000, interval: 50 },
    )
    // Let the reload finish re-parsing the rules before the old build completes.
    await new Promise((resolve) => setTimeout(resolve, 100))
    finishFirstBuild()
    await firstRequest

    await rewriter(request)

    expect(createMatcher).toHaveBeenCalledTimes(2)
    expect(createMatcher.mock.calls[1][0]).toMatchObject([{ to: '/newer' }])
  })
})
