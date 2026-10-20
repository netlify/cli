import { confirm } from '@inquirer/prompts'
import type { NetlifyAPI } from '@netlify/api'
import { TimeoutError } from 'p-wait-for'
import terminalLink from 'terminal-link'

import { startSpinner } from '../../lib/spinner.js'
import { chalk, exit, log, logAndThrowError, NETLIFYDEVLOG, warn } from '../../utils/command-helpers.js'
import { DEFAULT_DEPLOY_TIMEOUT } from '../../utils/deploy/constants.js'
import { getDeploySource } from '../../utils/deploy/deploy-source.js'
import { getDeployUrls, type DeployUrls } from '../../utils/deploy/deploy-urls.js'
import type { GitCommandObserver } from './remote/git.js'
import {
  prepareSourceCommit,
  RemoteBuildError,
  resolveRemoteSource,
  type RemoteSource,
  type SourceCommit,
} from './remote/source.js'
import { followDeploy } from './remote/follow.js'
import { DeployStateError } from '../../utils/deploy/util.js'
import { isInteractive } from '../../utils/scripted-commands.js'
import type { SiteInfo } from '../../utils/types.js'
import type { DeployOptionValues } from './option_values.js'

// FIXME(@netlify/api): the `createSiteBuild` response type makes `id` and `deploy_id` optional
type CreatedBuild = Awaited<ReturnType<NetlifyAPI['createSiteBuild']>> & { id: string; deploy_id: string }

export interface RemoteDeployResults extends DeployUrls {
  siteId: string
  siteName: string
  deployId: string
  commitSha: string
}

const describeSource = (source: RemoteSource): string => `Checking your commit is on ${source.repoUrl}`

type DebugLog = (message: string) => void

const describeMode = (source: RemoteSource): string => `external (${source.repoUrl}), nothing is pushed`

const describeUntracked = (files: string[], sha: string, repoUrl: string): string => {
  const shown = files.slice(0, 5).join(', ')
  const more = files.length > 5 ? ` and ${String(files.length - 5)} more` : ''
  return `${String(files.length)} untracked ${files.length === 1 ? 'file' : 'files'} won't be in this deploy, since Netlify builds ${sha} from ${repoUrl}: ${shown}${more}`
}

const logGitCommand =
  (debugLog: DebugLog): GitCommandObserver =>
  ({ args, cwd, exitCode, stderr }) => {
    debugLog(`git ${args.join(' ')} (in ${cwd}) exited ${String(exitCode)}`)
    if (exitCode !== 0 && stderr) {
      debugLog(stderr)
    }
  }

export const remoteDeploy = async ({
  api,
  workingDir,
  options,
  siteData,
  deployToProduction,
  prepareProductionDeploy,
}: {
  api: NetlifyAPI
  workingDir: string
  options: DeployOptionValues
  siteData: SiteInfo
  deployToProduction: boolean
  /** Called only once the source checks pass, so production isn't unlocked for a deploy that then fails. */
  prepareProductionDeploy: () => Promise<void>
}): Promise<RemoteDeployResults> => {
  const quiet = Boolean(options.json || options.silent)
  const siteId = siteData.id
  const timeoutMs = options.timeout ? options.timeout * 1000 : DEFAULT_DEPLOY_TIMEOUT
  const debugLog: DebugLog | undefined = options.debug
    ? (message) => {
        log(`${NETLIFYDEVLOG} ${chalk.dim(message)}`)
      }
    : undefined
  const onCommand = debugLog && logGitCommand(debugLog)

  let source: RemoteSource
  let commit: SourceCommit
  // Debug output would interleave with the spinner's redraws.
  const spinner = debugLog ? undefined : startSpinner({ text: 'Preparing your source for a remote build' })
  try {
    const { provider, repo_url: repoUrl, repo_branch: productionBranch } = siteData.build_settings ?? {}
    debugLog?.(
      `Project repository: ${repoUrl ?? '(none)'} (${provider ?? 'no provider'}), production branch ${productionBranch ?? '(none)'}`,
    )
    source = await resolveRemoteSource({
      siteInfo: siteData,
      workingDir,
      onCommand,
      production: deployToProduction,
    })
    debugLog?.(`Mode: ${describeMode(source)}`)
    spinner?.update({ text: describeSource(source) })
    commit = await prepareSourceCommit(source)
  } catch (error) {
    spinner?.error()
    if (error instanceof RemoteBuildError) {
      return logAndThrowError(error.message)
    }
    throw error
  }
  const shortSha = commit.sha.slice(0, 7)
  const foundText = `Found ${shortSha} on ${source.repoUrl}`
  if (spinner) {
    spinner.success({ text: foundText })
  } else {
    log(`${chalk.green('✔')} ${foundText}`)
  }

  if (source.untracked.length !== 0) {
    warn(describeUntracked(source.untracked, shortSha, source.repoUrl))
    if (isInteractive() && !quiet && !(await confirm({ message: 'Deploy anyway?', default: true }))) {
      exit(0)
    }
  }

  if (deployToProduction) {
    await prepareProductionDeploy()
  }

  debugLog?.(
    `Requesting a ${deployToProduction ? 'production' : 'draft'} build of ${commit.sha} on branch ${commit.branch ?? '(none)'}`,
  )
  let build: CreatedBuild
  try {
    build = (await api.createSiteBuild({
      siteId,
      branch: commit.branch,
      title: options.message,
      // @ts-expect-error FIXME(@netlify/api): `createSiteBuild` doesn't declare `commit_sha`, `draft` or `deploy_source`; the client drops undeclared query params, so they go in the body
      body: { commit_sha: commit.sha, draft: !deployToProduction, deploy_source: getDeploySource() },
    })) as CreatedBuild
  } catch (error) {
    const { json, message } = error as { json?: { message?: string; error?: string }; message: string }
    return logAndThrowError(`Couldn't start a build of ${commit.sha}: ${json?.message ?? json?.error ?? message}`)
  }

  debugLog?.(`Build ${build.id}, deploy ${build.deploy_id}`)
  const { logsUrl } = getDeployUrls({ id: build.deploy_id, admin_url: siteData.admin_url }, { deployToProduction })
  // Not on the spinner, which writes to stderr, so non-interactive output says what's being built.
  log(`${NETLIFYDEVLOG} Building ${shortSha} on Netlify (${terminalLink('↗ View deploy logs', logsUrl)})`)
  log('')

  try {
    const deploy = await followDeploy(api, {
      siteId,
      deployId: build.deploy_id,
      timeoutMs,
      onLogLine: quiet
        ? undefined
        : (line) => {
            log(`${chalk.dim('│')} ${line.trimEnd()}`)
          },
    })
    return {
      siteId,
      siteName: siteData.name,
      deployId: build.deploy_id,
      commitSha: commit.sha,
      ...getDeployUrls(deploy, { deployToProduction }),
    }
  } catch (error) {
    if (error instanceof DeployStateError) {
      return logAndThrowError(`Deploy failed: ${error.message}\n\nDeploy logs: ${logsUrl}`)
    }
    const timeoutHint = error instanceof TimeoutError ? ' To wait longer, pass a larger --timeout (in seconds).' : ''
    return logAndThrowError(
      `${(error as Error).message}\n\nThe build may still be running on Netlify.${timeoutHint} Deploy logs: ${logsUrl}`,
    )
  }
}
