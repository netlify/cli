import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

import { vi } from 'vitest'

const execFileAsync = promisify(execFile)

export const git = async (cwd: string, ...args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync('git', args, { cwd })
  return stdout.trim()
}

export const writeFiles = async (dir: string, files: Record<string, string>): Promise<void> => {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await writeFile(join(dir, path), content)
  }
}

/**
 * Isolates git, in this process and any child process such as the CLI, from the developer's own
 * configuration, so commits are reproducible and unsigned. Undo with `vi.unstubAllEnvs()`.
 */
export const isolateGitConfig = async (dir: string): Promise<void> => {
  const configPath = join(dir, 'gitconfig')
  await writeFile(
    configPath,
    [
      '[init]',
      '\tdefaultBranch = main',
      '[commit]',
      '\tgpgsign = false',
      '[user]',
      '\tname = Test User',
      '\temail = test@example.com',
      '',
    ].join('\n'),
  )
  vi.stubEnv('GIT_CONFIG_GLOBAL', configPath)
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  // Fixed dates make commit SHAs deterministic, e.g. for snapshots.
  vi.stubEnv('GIT_AUTHOR_DATE', '2026-01-01T00:00:00Z')
  vi.stubEnv('GIT_COMMITTER_DATE', '2026-01-01T00:00:00Z')
  for (const name of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL']) {
    vi.stubEnv(name, undefined)
  }
}

export const initPushedRepository = async (dir: string, remote: string): Promise<void> => {
  await git(dir, 'init', '--quiet')
  await git(dir, 'add', '--all')
  await git(dir, 'commit', '--quiet', '--message', 'Initial commit')
  await git(dir, 'remote', 'add', 'origin', remote)
  await git(dir, 'push', '--quiet', '--set-upstream', 'origin', 'main')
}

export interface GitSandbox {
  root: string
  /** A bare repository standing in for the git provider. */
  remote: string
  createDir: (name: string, files?: Record<string, string>) => Promise<string>
  createClone: (name: string, files: Record<string, string>) => Promise<string>
  cleanup: () => Promise<void>
}

export const createGitSandbox = async (): Promise<GitSandbox> => {
  const root = await mkdtemp(join(tmpdir(), 'netlify-remote-deploy-'))
  await isolateGitConfig(root)

  const remote = join(root, 'remote.git')
  await git(root, 'init', '--bare', '--quiet', remote)

  const createDir = async (name: string, files: Record<string, string> = {}) => {
    const dir = join(root, name)
    await mkdir(dir, { recursive: true })
    await writeFiles(dir, files)
    return dir
  }

  return {
    root,
    remote,
    createDir,
    createClone: async (name, files) => {
      const dir = await createDir(name, files)
      await initPushedRepository(dir, remote)
      return dir
    },
    cleanup: async () => {
      vi.unstubAllEnvs()
      await rm(root, { recursive: true, force: true })
    },
  }
}
