import { describe, expect, it, vi } from 'vitest'

import { resolveDeployIdFromUrl } from '../../../../src/commands/logs/log-api.js'

describe('resolveDeployIdFromUrl', () => {
  it.each([
    { site: 'my-site', branch: 'staging' },
    { site: 'my-site', branch: 'feature--logs' },
    { site: 'my--site', branch: 'staging' },
    { site: 'my--site', branch: 'feature--logs' },
  ])('resolves branch $branch for site $site', async ({ site, branch }) => {
    const listSiteDeploys = vi.fn().mockResolvedValue([{ id: 'branch-deploy', state: 'ready' }])
    const client = { listSiteDeploys } as never

    const deployId = await resolveDeployIdFromUrl(`https://${branch}--${site}.netlify.app`, client, 'site-id', {
      name: site,
    })

    expect(deployId).toBe('branch-deploy')
    expect(listSiteDeploys).toHaveBeenCalledWith({ siteId: 'site-id', branch, per_page: 20 })
  })

  it('resolves a deploy permalink without a branch lookup', async () => {
    const deployId = 'a'.repeat(24)
    const listSiteDeploys = vi.fn()

    await expect(
      resolveDeployIdFromUrl(`https://${deployId}--my-site.netlify.app`, { listSiteDeploys } as never, 'site-id', {
        name: 'my-site',
      }),
    ).resolves.toBe(deployId)
    expect(listSiteDeploys).not.toHaveBeenCalled()
  })

  it('uses the canonical site URL without a branch lookup', async () => {
    const listSiteDeploys = vi.fn()

    await expect(
      resolveDeployIdFromUrl('https://my-site.netlify.app', { listSiteDeploys } as never, 'site-id', {
        name: 'my-site',
      }),
    ).resolves.toBeUndefined()
    expect(listSiteDeploys).not.toHaveBeenCalled()
  })

  it.each([
    'https://staging--other-site.netlify.app',
    'https://staging--my-site.extra.netlify.app',
    'https://extra.staging--my-site.netlify.app',
    'https://--my-site.netlify.app',
  ])('rejects an invalid branch URL %s before looking up deploys', async (url) => {
    const listSiteDeploys = vi.fn()

    await expect(
      resolveDeployIdFromUrl(url, { listSiteDeploys } as never, 'site-id', { name: 'my-site' }),
    ).rejects.toThrow("doesn't seem to match the linked project")
    expect(listSiteDeploys).not.toHaveBeenCalled()
  })
})
