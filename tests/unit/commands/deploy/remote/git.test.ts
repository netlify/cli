import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  getHead,
  getRemoteBranchesContaining,
  getWorkTreeStatus,
  type GitCommand,
} from '../../../../../src/commands/deploy/remote/git.js'
import { createGitSandbox, git, writeFiles, type GitSandbox } from '../../../../utils/git.js'

let sandbox: GitSandbox

beforeEach(async () => {
  sandbox = await createGitSandbox()
})

afterEach(async () => {
  await sandbox.cleanup()
})

describe('inspecting a clone', () => {
  test('reports every git command to the observer', async () => {
    const project = await sandbox.createDir('project', { 'index.html': 'v1' })
    const commands: GitCommand[] = []
    const ctx = { cwd: project, onCommand: (command: GitCommand) => commands.push(command) }

    expect(await getHead(ctx)).toBeUndefined()
    await expect(getWorkTreeStatus(ctx)).rejects.toThrow()

    expect(commands.map(({ args }) => args[0])).toEqual(['rev-parse', 'status'])
    const failedStatus = commands.at(-1)
    expect(failedStatus).toMatchObject({ cwd: project, exitCode: 128 })
    expect(failedStatus?.stderr).toMatch(/not a git repository/)
  })

  test('getRemoteBranchesContaining lists remote-tracking branches with the commit', async () => {
    const project = await sandbox.createClone('project', { 'index.html': 'v1' })
    const head = await git(project, 'rev-parse', 'HEAD')

    expect(await getRemoteBranchesContaining({ cwd: project }, head)).toEqual(['origin/main'])

    await writeFiles(project, { 'index.html': 'v2' })
    await git(project, 'commit', '--quiet', '--all', '--message', 'Unpushed')
    const unpushed = await git(project, 'rev-parse', 'HEAD')

    expect(await getRemoteBranchesContaining({ cwd: project }, unpushed)).toEqual([])
  })
})
