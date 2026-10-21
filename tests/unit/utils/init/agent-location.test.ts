import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { findProjectSetupBlocker } from '../../../../src/utils/init/agent-location.js'

describe('findProjectSetupBlocker', () => {
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
    await expect(findProjectSetupBlocker(home, home)).resolves.toMatch(/home directory/)
  })

  test('blocks a path that resolves to the home directory through a symlink', async () => {
    const link = join(root, 'link-to-home')
    await symlink(home, link)
    await expect(findProjectSetupBlocker(link, home)).resolves.toMatch(/home directory/)
  })

  test('blocks the root of the file system', async () => {
    await expect(findProjectSetupBlocker(parse(root).root, home)).resolves.toMatch(/root of the file system/)
  })

  test('allows an empty folder, where an agent starts a new site', async () => {
    const empty = join(root, 'new-site')
    await mkdir(empty)
    await expect(findProjectSetupBlocker(empty, home)).resolves.toBeUndefined()
  })

  test('allows a project nested inside the home directory', async () => {
    const project = join(home, 'code', 'site')
    await mkdir(project, { recursive: true })
    await expect(findProjectSetupBlocker(project, home)).resolves.toBeUndefined()
  })
})
