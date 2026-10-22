import { isNetlifyGitUrl, isSameRepository } from '../../../utils/netlify-git.js'
import type { SiteInfo } from '../../../utils/types.js'
import {
  getCurrentBranch,
  getGitVersion,
  getHead,
  getRemotes,
  getUpstream,
  getRemoteBranchesContaining,
  getWorkTreeStatus,
  type GitCommandObserver,
  type GitContext,
} from './git.js'

export type RemoteSource = {
  kind: 'external'
  repoUrl: string
  head: string
  branch: string
  untracked: string[]
}

export interface SourceCommit {
  sha: string
  branch?: string
}

/** A problem the user can fix, as opposed to an unexpected failure. */
export class RemoteBuildError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RemoteBuildError'
  }
}

const describeGitProblem = (version: string | undefined): string | undefined => {
  if (!version) {
    return "--remote uses git, which isn't installed or isn't on your PATH. Install git, then deploy again."
  }
  const [major, minor] = version.split('.').map(Number)
  // 2.13 added `git branch --format`.
  if (major < 2 || (major === 2 && minor < 13)) {
    return `--remote needs git 2.13 or later, but you have ${version}. Update git, then deploy again.`
  }
  return undefined
}

type CloneState =
  | { pushed: true; head: string; branch?: string; untracked: string[] }
  | { pushed: false; reason: string }

const inspectClone = async (ctx: GitContext, repoUrl: string, productionBranch: string): Promise<CloneState> => {
  const head = await getHead(ctx)
  if (!head) {
    return {
      pushed: false,
      reason: `This directory isn't a clone of ${repoUrl}, which Netlify builds this project from. Run this from a clone of it.`,
    }
  }
  // Another remote having the commit doesn't mean the provider can build it.
  const providerRemotes = (await getRemotes(ctx))
    .filter(({ url }) => isSameRepository(url, repoUrl))
    .map(({ name }) => name)
  if (providerRemotes.length === 0) {
    return {
      pushed: false,
      reason: `This repository has no remote for ${repoUrl}, which Netlify builds this project from. Run this from a clone of it, or add a remote for it.`,
    }
  }
  const { hasChanges, untracked } = await getWorkTreeStatus(ctx)
  if (hasChanges) {
    return {
      pushed: false,
      reason: `You have uncommitted changes. Netlify builds this project from ${repoUrl}, so commit them and push them to ${productionBranch} or another branch, then deploy again.`,
    }
  }
  const remoteOf = (ref: string) => providerRemotes.find((remote) => ref.startsWith(`${remote}/`))
  const pushedTo = (await getRemoteBranchesContaining(ctx, head)).filter((ref) => remoteOf(ref) !== undefined)
  if (pushedTo.length === 0) {
    return {
      pushed: false,
      reason: `Your checked-out commit isn't on ${repoUrl} as of your last fetch. Push it to ${productionBranch} or another branch (or fetch, if you already pushed it), then deploy again.`,
    }
  }
  // Only a branch the user evidently pushed this commit to, never a guess among other branches that
  // happen to contain it.
  const currentBranch = await getCurrentBranch(ctx)
  const candidates = [
    await getUpstream(ctx),
    ...(currentBranch ? providerRemotes.map((remote) => `${remote}/${currentBranch}`) : []),
  ]
  const ref = candidates.find((candidate) => candidate !== undefined && pushedTo.includes(candidate))
  return { pushed: true, head, branch: ref?.slice((remoteOf(ref) ?? '').length + 1), untracked }
}

export const resolveRemoteSource = async ({
  siteInfo,
  workingDir,
  onCommand,
  production = false,
}: {
  siteInfo: SiteInfo
  workingDir: string
  onCommand?: GitCommandObserver
  production?: boolean
}): Promise<RemoteSource> => {
  const settings = siteInfo.build_settings
  if (!settings?.repo_url) {
    throw new RemoteBuildError(
      'This project has no repository for Netlify to build from, so it can only be deployed with a local build.',
    )
  }
  const productionBranch = settings.repo_branch

  const ctx = { cwd: workingDir, onCommand }

  if (settings.provider !== 'netlify-git' && !isNetlifyGitUrl(settings.repo_url)) {
    const gitProblem = describeGitProblem(await getGitVersion(ctx))
    if (gitProblem) {
      throw new RemoteBuildError(gitProblem)
    }
    const repoUrl = settings.repo_url
    const clone = await inspectClone(ctx, repoUrl, productionBranch)
    if (clone.pushed) {
      // Any pushed commit can go to production: the build fetches it by SHA, not from the branch.
      const branch = production ? productionBranch : clone.branch
      if (!branch) {
        throw new RemoteBuildError(
          `Couldn't tell which branch to build ${clone.head.slice(0, 7)} as: it isn't on your checked-out branch's upstream or a branch of the same name on ${repoUrl}. Check out the branch you pushed it to, then deploy again.`,
        )
      }
      return { kind: 'external', repoUrl, head: clone.head, branch, untracked: clone.untracked }
    }
    throw new RemoteBuildError(clone.reason)
  }

  throw new RemoteBuildError(
    "Remote builds aren't supported yet for projects on Netlify Git. Deploy without --remote to build locally.",
  )
}

export const prepareSourceCommit = (source: RemoteSource): Promise<SourceCommit> =>
  Promise.resolve({ sha: source.head, branch: source.branch })
