import { chmod } from 'node:fs/promises'
import { join } from 'node:path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  prepareSourceCommit,
  RemoteBuildError,
  resolveRemoteSource,
} from '../../../../../src/commands/deploy/remote/source.js'
import type { SiteInfo } from '../../../../../src/utils/types.js'
import { createGitSandbox, git, writeFiles, type GitSandbox } from '../../../../utils/git.js'

let sandbox: GitSandbox | undefined

const setup = async () => {
  sandbox = await createGitSandbox()
  return sandbox
}

afterEach(async () => {
  await sandbox?.cleanup()
  sandbox = undefined
})

const getSiteInfo = (buildSettings: Partial<NonNullable<SiteInfo['build_settings']>> | undefined) =>
  ({ name: 'my-site', account_slug: 'my-team', build_settings: buildSettings }) as SiteInfo

const netlifyGitSettings = {
  provider: 'netlify-git',
  repo_url: 'https://hgit.services-prod.nsvcs.net/abc123',
  repo_branch: 'main',
}

describe('resolveRemoteSource', () => {
  test('rejects projects without a repository', async () => {
    const { createDir } = await setup()
    const dir = await createDir('project')

    await expect(resolveRemoteSource({ siteInfo: getSiteInfo(undefined), workingDir: dir })).rejects.toThrow(
      RemoteBuildError,
    )
    await expect(resolveRemoteSource({ siteInfo: getSiteInfo({ repo_url: '' }), workingDir: dir })).rejects.toThrow(
      RemoteBuildError,
    )
  })

  test.each([
    ['provider', netlifyGitSettings],
    [
      'repository URL',
      { provider: 'manual', repo_url: 'https://git.netlify.com/my-team/my-site.git', repo_branch: 'main' },
    ],
  ])('rejects Netlify Git projects, identified by their %s, as not supported yet', async (_, buildSettings) => {
    const { createClone } = await setup()
    const dir = await createClone('project', { 'index.html': 'hi' })

    const result = resolveRemoteSource({ siteInfo: getSiteInfo(buildSettings), workingDir: dir })

    await expect(result).rejects.toThrow(RemoteBuildError)
    await expect(result).rejects.toThrow(/aren't supported yet for projects on Netlify Git/)
  })
})

describe('resolveRemoteSource for a project on a third-party git host', () => {
  const resolve = (dir: string, repoUrl: string, production?: boolean) =>
    resolveRemoteSource({
      siteInfo: getSiteInfo({ provider: 'github', repo_url: repoUrl, repo_branch: 'main' }),
      workingDir: dir,
      production,
    })

  test('builds the pushed HEAD of a clean clone from the provider', async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'switch', '--quiet', '--create', 'feature')
    await writeFiles(dir, { 'index.html': 'v2' })
    await git(dir, 'commit', '--quiet', '--all', '--message', 'Feature')
    await git(dir, 'push', '--quiet', '--set-upstream', 'origin', 'feature')
    const head = await git(dir, 'rev-parse', 'HEAD')

    const source = await resolve(dir, remote)

    expect(source).toEqual({
      kind: 'external',
      repoUrl: remote,
      head,
      branch: 'feature',
      untracked: [],
    })
    expect(await prepareSourceCommit(source)).toEqual({ sha: head, branch: 'feature' })
  })

  test('builds the production branch from the provider for production', async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    const head = await git(dir, 'rev-parse', 'HEAD')

    expect(await resolve(dir, remote, true)).toMatchObject({
      kind: 'external',
      head,
      branch: 'main',
    })
  })

  test('builds a commit pushed only to another branch for production, attributed to the production branch', async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'switch', '--quiet', '--create', 'feature')
    await writeFiles(dir, { 'index.html': 'v2' })
    await git(dir, 'commit', '--quiet', '--all', '--message', 'Feature')
    await git(dir, 'push', '--quiet', '--set-upstream', 'origin', 'feature')
    const head = await git(dir, 'rev-parse', 'HEAD')

    expect(await resolve(dir, remote, true)).toMatchObject({
      kind: 'external',
      head,
      branch: 'main',
    })
  })

  test("attributes the build to the upstream branch, even when it's named differently", async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'switch', '--quiet', '--create', 'feature')
    await writeFiles(dir, { 'index.html': 'v2' })
    await git(dir, 'commit', '--quiet', '--all', '--message', 'Feature')
    await git(dir, 'push', '--quiet', '--set-upstream', 'origin', 'feature:someone/feature')

    expect(await resolve(dir, remote)).toMatchObject({ branch: 'someone/feature' })
  })

  test('attributes the build to the same-named branch when there is no upstream', async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'switch', '--quiet', '--create', 'feature')
    await writeFiles(dir, { 'index.html': 'v2' })
    await git(dir, 'commit', '--quiet', '--all', '--message', 'Feature')
    await git(dir, 'push', '--quiet', 'origin', 'feature')

    expect(await resolve(dir, remote)).toMatchObject({ branch: 'feature' })
  })

  test("doesn't guess a branch for a draft when the commit is only on other branches", async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'switch', '--quiet', '--create', 'feature')
    await writeFiles(dir, { 'index.html': 'v2' })
    await git(dir, 'commit', '--quiet', '--all', '--message', 'Feature')
    await git(dir, 'push', '--quiet', 'origin', 'feature:other')

    await expect(resolve(dir, remote)).rejects.toThrow(/Couldn't tell which branch to build/)
    expect(await resolve(dir, remote, true)).toMatchObject({ branch: 'main' })
  })

  test('recognizes remote branches when a local branch is named like one', async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'branch', 'origin/main')

    expect(await resolve(dir, remote)).toMatchObject({ branch: 'main' })
  })

  test('reports untracked files rather than treating them as uncommitted changes', async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await writeFiles(dir, { 'scratch.txt': 'notes' })

    expect(await resolve(dir, remote)).toMatchObject({ branch: 'main', untracked: ['scratch.txt'] })
  })

  test("prefers the checked-out branch's upstream when several branches have the commit", async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'push', '--quiet', 'origin', 'main:aaa')

    expect(await resolve(dir, remote)).toMatchObject({ branch: 'main' })
  })

  test("doesn't guess a branch for a draft from a detached HEAD", async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })
    await git(dir, 'switch', '--quiet', '--detach')

    await expect(resolve(dir, remote)).rejects.toThrow(/Couldn't tell which branch to build/)
    expect(await resolve(dir, remote, true)).toMatchObject({ branch: 'main' })
  })

  test('recognizes the provider remote in another URL form', async () => {
    const { createClone, remote } = await setup()
    const dir = await createClone('project', { 'index.html': 'v1' })

    expect(await resolve(dir, remote.replace(/\.git$/, ''))).toMatchObject({ kind: 'external' })
  })

  test.each([
    [
      'uncommitted changes',
      async (sandbox: GitSandbox) => {
        const dir = await sandbox.createClone('project', { 'index.html': 'v1' })
        await writeFiles(dir, { 'index.html': 'v2' })
        return dir
      },
      /You have uncommitted changes\. .*commit them and push them to main or another branch/,
    ],
    [
      'an unpushed commit',
      async (sandbox: GitSandbox) => {
        const dir = await sandbox.createClone('project', { 'index.html': 'v1' })
        await writeFiles(dir, { 'index.html': 'v2' })
        await git(dir, 'commit', '--quiet', '--all', '--message', 'Unpushed')
        return dir
      },
      /isn't on .+ as of your last fetch\. Push it to main or another branch/,
    ],
    [
      'outside a clone',
      async (sandbox: GitSandbox) => sandbox.createDir('project', { 'index.html': 'v1' }),
      /isn't a clone of .+\. Run this from a clone of it\./,
    ],
    [
      'without a remote for the provider repository',
      async (sandbox: GitSandbox) => {
        const dir = await sandbox.createClone('project', { 'index.html': 'v1' })
        await git(dir, 'remote', 'remove', 'origin')
        await writeFiles(dir, { 'index.html': 'v2' })
        return dir
      },
      /has no remote for .+\. Run this from a clone of it, or add a remote for it\./,
    ],
    [
      'with HEAD pushed only to another remote',
      async (sandbox: GitSandbox) => {
        const dir = await sandbox.createClone('project', { 'index.html': 'v1' })
        const elsewhere = join(sandbox.root, 'elsewhere.git')
        await git(sandbox.root, 'init', '--bare', '--quiet', elsewhere)
        await git(dir, 'remote', 'set-url', 'origin', elsewhere)
        await git(dir, 'push', '--quiet', 'origin', 'main')
        return dir
      },
      /has no remote for .+\. Run this from a clone of it, or add a remote for it\./,
    ],
  ])('explains how to deploy %s', async (_, createProject, reason) => {
    const created = await setup()
    const dir = await createProject(created)

    const result = resolve(dir, created.remote)

    await expect(result).rejects.toThrow(RemoteBuildError)
    await expect(result).rejects.toThrow(reason)
  })
})

describe('resolveRemoteSource git check', () => {
  const resolveGitHub = (dir: string) =>
    resolveRemoteSource({
      siteInfo: getSiteInfo({ provider: 'github', repo_url: 'https://github.com/team/site', repo_branch: 'main' }),
      workingDir: dir,
    })

  test('fails with guidance when git is not installed', async () => {
    const { createDir } = await setup()
    const dir = await createDir('project')
    vi.stubEnv('PATH', await createDir('empty-bin'))

    await expect(resolveGitHub(dir)).rejects.toThrow(
      "--remote uses git, which isn't installed or isn't on your PATH. Install git, then deploy again.",
    )
  })

  test.skipIf(process.platform === 'win32')('fails with guidance when git is too old', async () => {
    const { createDir } = await setup()
    const bin = await createDir('bin', { git: '#!/bin/sh\necho "git version 2.12.5"\n' })
    await chmod(join(bin, 'git'), 0o755)
    vi.stubEnv('PATH', bin)

    await expect(resolveGitHub(await createDir('project'))).rejects.toThrow(
      '--remote needs git 2.13 or later, but you have 2.12.5. Update git, then deploy again.',
    )
  })
})
