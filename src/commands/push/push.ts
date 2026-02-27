import type { OptionValues } from 'commander'
import * as p from '@clack/prompts'
import terminalLink from 'terminal-link'

import { DEPLOY_POLL, DEFAULT_DEPLOY_TIMEOUT } from '../../utils/deploy/constants.js'
import { getDeployUrls } from '../../utils/deploy/deploy-output.js'
import { chalk, logAndThrowError, NETLIFY_CYAN } from '../../utils/command-helpers.js'
import execa from '../../utils/execa.js'
import type BaseCommand from '../base-command.js'

const DEPLOY_STATE_MESSAGES: Record<string, string> = {
  new: 'Build triggered',
  enqueued: 'Build enqueued',
  building: 'Building...',
  uploading: 'Deploying...',
  uploaded: 'Deploying...',
  preparing: 'Preparing deploy...',
  prepared: 'Preparing deploy...',
  processing: 'Processing...',
  processed: 'Processing...',
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const prettyLink = (url: string) => terminalLink(url, url, { fallback: false })

const printDeploySuccess = (deploy: {
  id?: string
  ssl_url?: string
  url?: string
  deploy_ssl_url?: string
  deploy_url?: string
  admin_url?: string
}) => {
  const urls = getDeployUrls(deploy)

  p.log.success(`Production URL: ${prettyLink(urls.siteUrl)}`)
  p.log.step(`Unique deploy URL: ${prettyLink(urls.deployUrl)}`)
  p.log.step(`Build logs: ${prettyLink(urls.logsUrl)}`)
  p.log.step(`Function logs: ${prettyLink(urls.functionLogsUrl)}`)
  p.log.step(`Edge function logs: ${prettyLink(urls.edgeFunctionLogsUrl)}`)
}

interface Build {
  sha?: string
  deploy_id?: string
  done?: boolean
  error?: string
}

/**
 * Fetch builds for a site, optionally filtered by commit SHA.
 * Uses a direct fetch because the `sha` query param is not yet in the OpenAPI spec.
 */
const fetchBuilds = async (api: BaseCommand['netlify']['api'], siteId: string, sha?: string): Promise<Build[]> => {
  const params = new URLSearchParams()
  if (sha) {
    params.set('sha', sha)
  }
  const qs = params.toString()
  const url = `${api.basePath}/sites/${siteId}/builds${qs ? `?${qs}` : ''}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${api.accessToken ?? ''}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch builds: ${response.status.toString()}`)
  }
  return (await response.json()) as Build[]
}

const waitForBuildAndDeploy = async (
  api: BaseCommand['netlify']['api'],
  siteId: string,
  commitSha: string,
  s: ReturnType<typeof p.spinner>,
) => {
  s.start('Waiting for build...')

  const startTime = Date.now()

  // Phase 1: Poll for a build matching our commit SHA
  let deployId: string | undefined
  while (Date.now() - startTime < DEFAULT_DEPLOY_TIMEOUT) {
    try {
      const builds = await fetchBuilds(api, siteId, commitSha)
      const matchingBuild = builds.at(0)

      if (matchingBuild) {
        // Check if the build itself errored before producing a deploy
        if (matchingBuild.done && matchingBuild.error && !matchingBuild.deploy_id) {
          s.stop('Build failed')
          return logAndThrowError(`Build failed: ${matchingBuild.error}`)
        }

        if (matchingBuild.deploy_id) {
          deployId = matchingBuild.deploy_id
          break
        }

        s.message('Build triggered')
      }
    } catch {
      // Swallow transient API errors, retry next interval
    }

    await sleep(DEPLOY_POLL)
  }

  if (!deployId) {
    s.stop('Timed out waiting for build')
    return logAndThrowError('Timed out waiting for build to start. Check the Netlify dashboard for status.')
  }

  // Stop the build-polling spinner before printing the log URL
  s.stop('Build started')

  // Print deploy logs URL
  try {
    const deploy = await api.getSiteDeploy({ siteId, deployId })
    const urls = getDeployUrls(deploy)
    p.log.step(`Deploy logs streaming here: ${prettyLink(urls.logsUrl)}`)
  } catch {
    // Non-critical, continue polling
  }

  // Phase 2: Poll deploy status until terminal state
  const s2 = p.spinner()
  s2.start('Building...')

  while (Date.now() - startTime < DEFAULT_DEPLOY_TIMEOUT) {
    try {
      const deploy = await api.getSiteDeploy({ siteId, deployId })

      if (deploy.state === 'ready') {
        s2.stop('Site is live!')
        printDeploySuccess(deploy)
        return
      }

      if (deploy.state === 'error') {
        s2.stop('Deploy failed')
        return logAndThrowError(`Deploy failed: ${deploy.error_message || 'Unknown error'}`)
      }

      const message = DEPLOY_STATE_MESSAGES[deploy.state ?? '']
      if (message) {
        s2.message(message)
      }
    } catch {
      // Swallow transient API errors, retry next interval
    }

    await sleep(DEPLOY_POLL)
  }

  s2.stop('Timed out waiting for deploy')
  return logAndThrowError('Deploy timed out. Check the Netlify dashboard for status.')
}

export const push = async (options: OptionValues, command: BaseCommand) => {
  p.intro(NETLIFY_CYAN.underline('Push to Netlify'))

  await command.authenticate()

  // 1. Verify netlify remote exists
  const { stdout: remotes } = await execa('git', ['remote'])
  if (!remotes.includes('netlify')) {
    p.cancel('No netlify remote found.')
    return logAndThrowError('No netlify remote found. Run `netlify init --git` first.')
  }

  const s = p.spinner()

  // 2. Check if this is a fresh repo with no commits yet
  let isInitialCommit = false
  try {
    await execa('git', ['rev-parse', 'HEAD'])
  } catch {
    isInitialCommit = true
  }

  // 3. Check for working tree changes (unstaged + staged)
  const { stdout: status } = await execa('git', ['status', '--porcelain'])
  const hasChanges = status.trim().length > 0

  if (hasChanges) {
    // Stage everything
    s.start('Staging changes')
    await execa('git', ['add', '.'])

    // Build a colorful diff summary: +insertions -deletions N files changed
    const { stdout: diffStat } = await execa('git', ['diff', '--cached', '--shortstat'], { reject: false })
    const filesMatch = /(\d+) files? changed/.exec(diffStat)
    const insertMatch = /(\d+) insertions?/.exec(diffStat)
    const deleteMatch = /(\d+) deletions?/.exec(diffStat)
    const parts: string[] = []
    if (insertMatch) parts.push(chalk.green(`+${insertMatch[1]}`))
    if (deleteMatch) parts.push(chalk.red(`-${deleteMatch[1]}`))
    if (filesMatch) parts.push(`${filesMatch[1]} files changed`)
    const summary = parts.length > 0 ? ` (${parts.join(' ')})` : ''
    s.stop(`Changes staged${summary}`)

    // Commit
    const userMessage = typeof options.message === 'string' ? options.message : undefined
    const message: string =
      userMessage ?? (isInitialCommit ? 'Initial deploy via Netlify CLI' : `Deploy at ${new Date().toLocaleString()}`)

    const commitResult = await execa(
      'git',
      ['commit', '--no-gpg-sign', '--author', 'Netlify CLI <no-reply@netlify.com>', '-m', message],
      { reject: false },
    )
    if (commitResult.exitCode !== 0 && !commitResult.stderr.includes('nothing to commit')) {
      p.cancel('Commit failed')
      return logAndThrowError(`Commit failed: ${commitResult.stderr}`)
    }
    p.log.success(userMessage ? `Committed: ${userMessage}` : 'Committed')
  } else if (!isInitialCommit) {
    // No local changes — check if there are unpushed commits.
    const { stdout: currentBranchName } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = currentBranchName.trim()
    // First check if the remote tracking branch exists at all (it won't before the first push).
    const { exitCode: remoteRefExists } = await execa('git', ['rev-parse', '--verify', `netlify/${branch}`], {
      reject: false,
    })
    if (remoteRefExists === 0) {
      // Use rev-list --count for a reliable machine-readable check
      const { stdout: countStr } = await execa('git', ['rev-list', '--count', `netlify/${branch}..HEAD`], {
        reject: false,
      })
      if (countStr.trim() === '0') {
        p.log.step('Everything up to date — nothing to push')
        p.outro('Already deployed!')
        return
      }
      p.log.step(`Pushing ${countStr.trim()} unpushed commit(s)`)
    } else {
      p.log.step('Pushing to Netlify for the first time')
    }
  }

  // 4. Push the current branch
  const { stdout: currentBranch } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  s.start(`Pushing ${currentBranch.trim()} to Netlify`)
  const pushResult = await execa('git', ['push', '--porcelain', '-u', 'netlify', currentBranch.trim()], {
    reject: false,
  })
  if (pushResult.exitCode !== 0) {
    s.stop('Push failed')
    p.cancel(pushResult.stderr || 'Push failed')
    return logAndThrowError(`Push failed: ${pushResult.stderr}`)
  }

  // --porcelain output format: <flag>\t<from>:<to>\t<summary>
  // flag '=' means up-to-date (nothing pushed), ' ' or other means data was transferred
  const porcelainOutput = pushResult.stdout.trim()
  if (porcelainOutput.includes('=\t') || porcelainOutput.includes('[up to date]')) {
    s.stop('Nothing to push')
    p.outro('Already deployed!')
    return
  }

  s.stop('Pushed to Netlify Git')

  // 5. Wait for build and deploy
  const siteId = command.netlify.site.id
  if (!siteId) {
    p.log.warn('No linked site found. Run `netlify link` to enable deploy tracking.')
    p.outro('Build triggered! Your deploy will start shortly.')
    return
  }

  const { stdout: shaOutput } = await execa('git', ['rev-parse', 'HEAD'])
  const commitSha = shaOutput.trim()

  const deploySpinner = p.spinner()
  await waitForBuildAndDeploy(command.netlify.api, siteId, commitSha, deploySpinner)
  p.outro('Deploy complete!')
}
