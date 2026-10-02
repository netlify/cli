import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { NormalizedCachedConfigConfig } from '../../../src/utils/command-helpers.js'
import { createRewriter, getLanguage, getWatchers } from '../../../src/utils/rules-proxy.js'
import type { Request } from '../../../src/utils/types.js'

describe('getLanguage', () => {
  test('detects language', () => {
    const language = getLanguage({ 'accept-language': 'ur' })

    expect(language).toBe('ur')
  })
})

describe('createRewriter', () => {
  const jwtSecret = 'test-secret'
  const jwtRoleClaim = 'app_metadata.authorization.roles'
  const directories: string[] = []

  const rewriterFor = async (redirectsFile: string, configRedirects: unknown[] = []) => {
    const projectDir = await mkdtemp(join(tmpdir(), 'rules-proxy-'))
    directories.push(projectDir)
    await writeFile(join(projectDir, '_redirects'), redirectsFile)

    const rewriter = await createRewriter({
      config: { redirects: configRedirects } as unknown as NormalizedCachedConfigConfig,
      jwtRoleClaim,
      jwtSecret,
      projectDir,
    })
    return { projectDir, rewriter }
  }

  const request = (url: string, headers: Record<string, string> = {}) =>
    ({ url, headers: { host: 'localhost:8888', ...headers } }) as unknown as Request

  const roleToken = (roles: string[]) =>
    jwt.sign({ app_metadata: { authorization: { roles } } }, jwtSecret, { expiresIn: '1h' })

  afterEach(async () => {
    await Promise.all(
      getWatchers()
        .splice(0)
        .map((watcher) => watcher.close()),
    )
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
  })

  test('matches a redirect rule', async () => {
    const { rewriter } = await rewriterFor('/old /new 301\n')

    expect(await rewriter(request('/old'))).toMatchObject({ type: 'match', status: 301, to: '/new', force: false })
    expect(await rewriter(request('/other'))).toBeNull()
  })

  test('forces a 404 for a role rule without a JWT', async () => {
    const { rewriter } = await rewriterFor('/admin/* /admin/:splat 200! Role=admin\n')

    expect(await rewriter(request('/admin/dashboard'))).toMatchObject({ type: 'forcedNotFound' })
  })

  test('forces a 404 for a role rule with a JWT for another role', async () => {
    const { rewriter } = await rewriterFor('/admin/* /admin/:splat 200! Role=admin\n')

    const result = await rewriter(request('/admin/dashboard', { cookie: `nf_jwt=${roleToken(['editor'])}` }))
    expect(result).toMatchObject({ type: 'forcedNotFound' })
  })

  test('matches a role rule with a JWT for the role', async () => {
    const { rewriter } = await rewriterFor('/admin/* /admin/:splat 200! Role=admin\n')

    const result = await rewriter(request('/admin/dashboard', { cookie: `nf_jwt=${roleToken(['admin'])}` }))
    expect(result).toMatchObject({ type: 'match', status: 200, to: '/admin/dashboard', force: true })
  })

  test('matches a Country condition from the nf_country cookie', async () => {
    const { rewriter } = await rewriterFor('/ /es/ 302 Country=es\n')

    expect(await rewriter(request('/', { cookie: 'nf_country=es' }))).toMatchObject({ type: 'match', to: '/es/' })
    expect(await rewriter(request('/', { cookie: 'nf_country=de' }))).toBeNull()
  })

  test('matches a Language condition from the Accept-Language header', async () => {
    const { rewriter } = await rewriterFor('/ /fr/ 302 Language=fr\n')

    const french = await rewriter(request('/', { 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.8' }))
    expect(french).toMatchObject({ type: 'match', to: '/fr/' })
    expect(await rewriter(request('/', { 'accept-language': 'en-US' }))).toBeNull()
  })

  test('reports the signing secret name of a signed rule', async () => {
    const { rewriter } = await rewriterFor('', [
      { from: '/api/*', to: 'https://api.example.com/:splat', status: 200, signed: 'SIGNING_VAR' },
    ])

    expect(await rewriter(request('/api/users'))).toMatchObject({
      type: 'match',
      to: 'https://api.example.com/users',
      signer: { jwtSecret: 'SIGNING_VAR' },
    })
  })

  test('reloads rules when the _redirects file changes', async () => {
    const { projectDir, rewriter } = await rewriterFor('/old /new 301\n')
    expect(await rewriter(request('/old'))).toMatchObject({ to: '/new' })

    await writeFile(join(projectDir, '_redirects'), '/old /newer 301\n')

    await vi.waitFor(
      async () => {
        expect(await rewriter(request('/old'))).toMatchObject({ to: '/newer' })
      },
      { timeout: 5000, interval: 100 },
    )
  })
})
