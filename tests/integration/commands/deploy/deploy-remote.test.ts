import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'

import type express from 'express'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WebSocketServer } from 'ws'

import { git, initPushedRepository, isolateGitConfig } from '../../../utils/git.js'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, type MockApi, type Route } from '../../utils/mock-api.js'
import { withSiteBuilder, type SiteBuilder } from '../../utils/site-builder.js'
import { normalize } from '../../utils/snapshots.js'
import { startDeployMockApi } from './deploy-api-routes.js'

const siteInfo = {
  id: 'site_id',
  name: 'test-site',
  account_slug: 'test-account',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
  build_settings: {
    provider: 'netlify-git',
    repo_url: 'https://hgit.services-prod.nsvcs.net/abc123',
    repo_branch: 'main',
  },
}

const readyDeploy = {
  id: 'deploy_id',
  site_id: 'site_id',
  name: 'test-site',
  state: 'ready',
  deploy_ssl_url: 'https://deploy-id--test-site.netlify.app',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
}

interface RemoteDeployOutput {
  deploy_id: string
  deploy_url: string
  commit_sha: string
  url?: string
}

interface Harness {
  mockApi: MockApi
  logServer?: WebSocketServer
  buildRequests: Record<string, unknown>[]
}

const startFakeDeployLog = async (lines: string[], onSent: () => void) => {
  const server = new WebSocketServer({ port: 0 })
  await once(server, 'listening')
  server.on('connection', (ws) => {
    ws.once('message', () => {
      for (const line of lines) {
        ws.send(JSON.stringify({ message: line }))
      }
      onSent()
    })
  })
  vi.stubEnv('NETLIFY_SOCKETEER_URL', `ws://localhost:${String((server.address() as AddressInfo).port)}`)
  return server
}

/**
 * With `buildLog`, the deploy stays building until those lines have been streamed. With `failWith`, the
 * deploy fails with that error. With `rejectBuildWith`, the API refuses to start the build. With `stuck`,
 * the deploy never finishes.
 */
const setUp = async (
  builder: SiteBuilder,
  site: Record<string, unknown> = siteInfo,
  {
    buildLog,
    failWith,
    rejectBuildWith,
    stuck,
  }: { buildLog?: string[]; failWith?: string; rejectBuildWith?: string; stuck?: boolean } = {},
): Promise<Harness> => {
  await isolateGitConfig(join(builder.directory, '..'))
  // Keeps the CLI off the real log stream; `startFakeDeployLog` points it at a local one instead.
  vi.stubEnv('NETLIFY_SOCKETEER_URL', 'ws://127.0.0.1:9')
  let deployState = failWith ? 'error' : buildLog || stuck ? 'building' : 'ready'
  const logServer =
    buildLog &&
    (await startFakeDeployLog(buildLog, () => {
      deployState = 'ready'
    }))

  const buildRequests: Record<string, unknown>[] = []
  const routes: Route[] = [
    { path: 'sites/site_id', response: site },
    { path: 'sites', method: 'GET', response: [site] },
    { path: 'accounts', response: [{ slug: 'test-account' }] },
    { path: 'accounts/test-account/env', response: [] },
    {
      path: 'sites/site_id/builds',
      method: 'POST',
      response: (req: express.Request, res: express.Response) => {
        buildRequests.push({ ...(req.query as Record<string, unknown>), ...(req.body as Record<string, unknown>) })
        if (rejectBuildWith) {
          res.status(403).json({ message: rejectBuildWith })
          return
        }
        res.json({ id: 'build_id', deploy_id: 'deploy_id' })
      },
    },
    {
      path: 'sites/site_id/deploys/deploy_id',
      method: 'GET',
      response: (_req: express.Request, res: express.Response) => {
        res.json({ ...readyDeploy, state: deployState, error_message: failWith })
      },
    },
  ]
  const mockApi = await startDeployMockApi({ routes })

  return { mockApi, logServer, buildRequests }
}

const setUpForgeProject = async (
  builder: SiteBuilder,
  options?: Parameters<typeof setUp>[2],
  siteOverrides: Record<string, unknown> = {},
) => {
  const forge = join(builder.directory, '..', 'forge.git')
  await git(builder.directory, 'init', '--bare', '--quiet', forge)
  const site = {
    ...siteInfo,
    build_settings: { provider: 'github', repo_url: forge, repo_branch: 'main' },
    ...siteOverrides,
  }
  const harness = await setUp(builder, site, options)
  await initPushedRepository(builder.directory, forge)
  return { harness, forge, head: await git(builder.directory, 'rev-parse', 'HEAD') }
}

const deployRemote = async (builder: SiteBuilder, harness: Harness, args: string[] = []): Promise<string> =>
  (await callCli(['deploy', '--remote', ...args], getCLIOptions({ apiUrl: harness.mockApi.apiUrl, builder }))) as string

const deployRemoteJson = async (builder: SiteBuilder, harness: Harness, args: string[] = []) =>
  JSON.parse(await deployRemote(builder, harness, ['--json', ...args])) as RemoteDeployOutput

describe('deploy --remote', () => {
  let harness: Harness | undefined

  beforeEach(() => {
    harness = undefined
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await harness?.mockApi.close()
    harness?.logServer?.close()
  })

  test('builds the pushed commit of a project on a third-party git host', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder)
      harness = project.harness

      const output = await deployRemoteJson(builder, harness)

      expect(output.commit_sha).toBe(project.head)
      expect(harness.buildRequests).toEqual([
        { commit_sha: project.head, branch: 'main', draft: true, deploy_source: 'cli' },
      ])
    })
  })

  test('streams the build log, then prints the draft URL and how to deploy it to production', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder, {
        buildLog: ['Installing dependencies', 'Build script success'],
      })
      harness = project.harness

      expect(normalize(await deployRemote(builder, harness))).toMatchSnapshot()
    })
  })

  test('prints the production URL when deploying to production', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder)
      harness = project.harness

      expect(normalize(await deployRemote(builder, harness, ['--prod']))).toMatchSnapshot()
    })
  })

  test('deploys an already-pushed commit from any branch to production without pushing', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Committed</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder)
      harness = project.harness
      await git(builder.directory, 'switch', '--quiet', '--create', 'feature')
      await git(builder.directory, 'commit', '--quiet', '--allow-empty', '--message', 'Feature')
      await git(builder.directory, 'push', '--quiet', '--set-upstream', 'origin', 'feature')
      const head = await git(builder.directory, 'rev-parse', 'HEAD')
      const forgeRefs = await git(project.forge, 'for-each-ref')

      const output = await deployRemoteJson(builder, harness, ['--prod'])

      expect(output.commit_sha).toBe(head)
      expect(harness.buildRequests).toEqual([{ commit_sha: head, branch: 'main', draft: false, deploy_source: 'cli' }])
      expect(await git(project.forge, 'for-each-ref')).toBe(forgeRefs)
    })
  })

  test('fails with guidance when the project has uncommitted changes', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Committed</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder)
      harness = project.harness
      await writeFile(join(builder.directory, 'index.html'), '<h1>Uncommitted</h1>')

      await expect(deployRemoteJson(builder, harness)).rejects.toThrow(
        /You have uncommitted changes\. .*commit them and push them/,
      )
      expect(harness.buildRequests).toEqual([])
    })
  })

  test('checks the source, then the production lock, before starting a production build', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Committed</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder, {}, { published_deploy: { id: 'published', locked: true } })
      harness = project.harness
      await writeFile(join(builder.directory, 'index.html'), '<h1>Uncommitted</h1>')

      await expect(deployRemoteJson(builder, harness, ['--prod'])).rejects.toThrow(/You have uncommitted changes/)

      await git(builder.directory, 'checkout', '--', 'index.html')

      await expect(deployRemoteJson(builder, harness, ['--prod'])).rejects.toThrow(/Deployments are "locked"/)
      expect(harness.buildRequests).toEqual([])
    })
  })

  test('warns about untracked files, which are not part of the deploy, and deploys anyway', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder)
      harness = project.harness
      await writeFile(join(builder.directory, 'scratch.txt'), 'notes')

      const output = await deployRemote(builder, harness)

      expect(output).toContain(`1 untracked file won't be in this deploy`)
      expect(output).toContain('scratch.txt')
      expect(harness.buildRequests).toHaveLength(1)
    })
  })

  test('fails with guidance when the checked-out commit is not pushed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Committed</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder)
      harness = project.harness
      await git(builder.directory, 'commit', '--quiet', '--allow-empty', '--message', 'Unpushed')

      await expect(deployRemoteJson(builder, harness, ['--prod'])).rejects.toThrow(
        /Your checked-out commit isn't on .+ as of your last fetch\. Push it to main/,
      )
      expect(harness.buildRequests).toEqual([])
    })
  })

  test('fails with the deploy error and a link to the deploy logs when the deploy fails', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder, { failWith: 'Build script returned non-zero exit code: 2' })
      harness = project.harness

      await expect(deployRemoteJson(builder, harness)).rejects.toThrow(
        /Deploy failed: Build script returned non-zero exit code: 2\s+Deploy logs: https:\/\/app\.netlify\.com\/projects\/test-site\/deploys\/deploy_id/,
      )
    })
  })

  test('says how to wait longer when the deploy times out', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder, { stuck: true })
      harness = project.harness

      await expect(deployRemoteJson(builder, harness, ['--timeout', '2'])).rejects.toThrow(
        /Timed out after 2 seconds waiting for the deploy to finish\. .*pass a larger --timeout/,
      )
    })
  })

  test("fails with the API's reason when it refuses to start the build", async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      const project = await setUpForgeProject(builder, {
        rejectBuildWith: 'Builds for this site are currently stopped',
      })
      harness = project.harness

      await expect(deployRemoteJson(builder, harness)).rejects.toThrow(
        `Couldn't start a build of ${project.head}: Builds for this site are currently stopped`,
      )
    })
  })

  test('fails as not supported yet for a project on Netlify Git', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      harness = await setUp(builder)

      await expect(deployRemoteJson(builder, harness)).rejects.toThrow(
        /aren't supported yet for projects on Netlify Git/,
      )
      expect(harness.buildRequests).toEqual([])
    })
  })

  test('fails without creating a project when no project is linked', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      harness = await setUp(builder)

      await expect(
        callCli(
          ['deploy', '--remote'],
          getCLIOptions({ apiUrl: harness.mockApi.apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
        ),
      ).rejects.toThrow(/--remote needs an existing Netlify project/)
      expect(
        harness.mockApi.requests.filter(({ method, path }) => method === 'POST' && path.endsWith('/sites')),
      ).toEqual([])
    })
  })

  test('fails with guidance when the project has no repository to build from', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withContentFile({ path: 'index.html', content: '<h1>Hi</h1>' })
      await builder.build()
      harness = await setUp(builder, { ...siteInfo, build_settings: { repo_url: '' } })

      await expect(deployRemoteJson(builder, harness)).rejects.toThrow(/isn't connected to a git repository/)
      expect(harness.buildRequests).toEqual([])
    })
  })

  test.each([['--dir', 'public'], ['--no-build'], ['--alias', 'preview'], ['--trigger']])(
    'rejects %s, which only applies to local builds',
    async (...flags) => {
      await expect(callCli(['deploy', '--remote', ...flags])).rejects.toThrow(/cannot be used with option/)
    },
  )
})
