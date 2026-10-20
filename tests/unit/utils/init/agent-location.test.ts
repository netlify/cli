import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { findAgentSetupBlocker } from '../../../../src/utils/init/agent-location.js'

describe('findAgentSetupBlocker', () => {
  let root: string
  let home: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'netlify-agent-location-'))
    home = join(root, 'home')
    await mkdir(home)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('blocks the home directory even when it is a git repository', async () => {
    await mkdir(join(home, '.git'))
    await expect(findAgentSetupBlocker(home, home)).resolves.toMatch(/home directory/)
  })

  test('blocks a path that resolves to the home directory through a symlink', async () => {
    const link = join(root, 'link-to-home')
    await symlink(home, link)
    await expect(findAgentSetupBlocker(link, home)).resolves.toMatch(/home directory/)
  })

  test('blocks a directory with no project marker', async () => {
    const empty = join(root, 'empty')
    await mkdir(empty)
    await expect(findAgentSetupBlocker(empty, home)).resolves.toMatch(/no \.git, package\.json, netlify\.toml found/)
  })

  test.each(['package.json', 'netlify.toml'])('allows a directory with %s', async (marker) => {
    const project = join(root, 'project')
    await mkdir(project)
    await writeFile(join(project, marker), '')
    await expect(findAgentSetupBlocker(project, home)).resolves.toBeUndefined()
  })

  test('allows a git worktree, where .git is a file', async () => {
    const worktree = join(root, 'worktree')
    await mkdir(worktree)
    await writeFile(join(worktree, '.git'), 'gitdir: /elsewhere\n')
    await expect(findAgentSetupBlocker(worktree, home)).resolves.toBeUndefined()
  })

  test('allows a project nested inside the home directory', async () => {
    const project = join(home, 'code', 'site')
    await mkdir(project, { recursive: true })
    await writeFile(join(project, 'package.json'), '{}')
    await expect(findAgentSetupBlocker(project, home)).resolves.toBeUndefined()
  })
})
