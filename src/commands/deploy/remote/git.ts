import { execFile, type ExecFileException } from 'node:child_process'
import { promisify } from 'node:util'

import semver from 'semver'

const execFileAsync = promisify(execFile)

export interface GitCommand {
  args: string[]
  cwd: string
  exitCode: number
  stderr: string
}

export type GitCommandObserver = (command: GitCommand) => void

export interface GitContext {
  cwd: string
  onCommand?: GitCommandObserver
}

// `code` is the exit code once git ran, or a string like ENOENT when it couldn't start.
const isFailedCommand = (error: unknown): error is ExecFileException & { code: number } =>
  error instanceof Error && 'code' in error && typeof error.code === 'number'

const run = async (ctx: GitContext, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  let result: { exitCode: number; stdout: string; stderr: string }
  try {
    // GIT_OPTIONAL_LOCKS keeps read-only commands like `git status` from refreshing the user's index.
    const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
    const { stdout, stderr } = await execFileAsync('git', args, { cwd: ctx.cwd, env })
    result = { exitCode: 0, stdout, stderr }
  } catch (error) {
    if (!isFailedCommand(error)) {
      throw new Error(`Couldn't run git: ${String(error)}`, { cause: error })
    }
    result = { exitCode: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' }
  }
  ctx.onCommand?.({ args, cwd: ctx.cwd, exitCode: result.exitCode, stderr: result.stderr.trimEnd() })
  return result
}

const git = async (ctx: GitContext, args: string[]): Promise<string> => {
  const { exitCode, stdout, stderr } = await run(ctx, args)
  if (exitCode !== 0) {
    throw new Error(`git ${args[0]} failed: ${stderr.trimEnd() || stdout}`)
  }
  return stdout.trim()
}

const tryGit = async (ctx: GitContext, args: string[]): Promise<string> => {
  const { exitCode, stdout } = await run(ctx, args)
  return exitCode === 0 ? stdout.trim() : ''
}

interface Remote {
  name: string
  url: string
}

export const getRemotes = async (ctx: GitContext): Promise<Remote[]> => {
  const names = (await tryGit(ctx, ['remote'])).split('\n').filter(Boolean)
  return Promise.all(names.map(async (name) => ({ name, url: await git(ctx, ['remote', 'get-url', name]) })))
}

export const getHead = (ctx: GitContext): Promise<string> => tryGit(ctx, ['rev-parse', '--verify', 'HEAD'])

export const getGitVersion = async (ctx: GitContext): Promise<string> => {
  const output = await tryGit(ctx, ['version']).catch(() => '')
  return semver.coerce(output)?.version ?? ''
}

// Full ref names, since short ones become ambiguous when a local branch is named like a remote one
// (e.g. `origin/main`).
const stripRefPrefix = (ref: string, prefix: string) => (ref.startsWith(prefix) ? ref.slice(prefix.length) : '')

export const getCurrentBranch = async (ctx: GitContext): Promise<string> =>
  stripRefPrefix(await tryGit(ctx, ['symbolic-ref', '--quiet', 'HEAD']), 'refs/heads/')

export const getUpstream = async (ctx: GitContext): Promise<string> =>
  stripRefPrefix(await tryGit(ctx, ['rev-parse', '--symbolic-full-name', '@{upstream}']), 'refs/remotes/')

export const getWorkTreeStatus = async (ctx: GitContext): Promise<{ hasChanges: boolean; untracked: string[] }> => {
  const lines = (await git(ctx, ['status', '--porcelain', '--untracked-files=normal'])).split('\n').filter(Boolean)
  return {
    hasChanges: lines.some((line) => !line.startsWith('?? ')),
    untracked: lines.filter((line) => line.startsWith('?? ')).map((line) => line.slice(3)),
  }
}

const listRemoteBranches = async (ctx: GitContext, filter: string[]): Promise<string[]> => {
  const output = await tryGit(ctx, ['branch', '--remotes', ...filter, '--format=%(refname:lstrip=2)'])
  return output.split('\n').filter((name) => name !== '' && !name.endsWith('/HEAD'))
}

export const getRemoteBranchesContaining = (ctx: GitContext, sha: string): Promise<string[]> =>
  listRemoteBranches(ctx, ['--contains', sha])
