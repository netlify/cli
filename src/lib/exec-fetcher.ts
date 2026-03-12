import { execFile as execFileCb } from 'child_process'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, unlink } from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import process from 'process'
import { promisify } from 'util'
import { createGunzip } from 'zlib'

import { isexe } from 'isexe'
import { unpackTar } from 'modern-tar/fs'
import semver from 'semver'

import { NETLIFYDEVWARN, logAndThrowError, getTerminalLink, log } from '../utils/command-helpers.js'

const execFile = promisify(execFileCb)

const isWindows = () => process.platform === 'win32'

const getRepository = ({ packageName }: { packageName: string }) => `netlify/${packageName}`

export const getExecName = ({ execName }: { execName: string }) => (isWindows() ? `${execName}.exe` : execName)

const getGitHubHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
  if (process.env.NETLIFY_TEST_GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.NETLIFY_TEST_GITHUB_TOKEN}`
  }
  return headers
}

const resolveLatestTag = async (repository: string): Promise<string> => {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers: getGitHubHeaders(),
  })
  if (!response.ok) {
    const text = await response.text()
    if (response.status === 403 && text.includes('API rate limit exceeded')) {
      throw new Error('GitHub API rate limit exceeded')
    }
    throw new Error(`Failed to fetch latest release for ${repository}: ${String(response.status)} ${text}`)
  }
  const data = (await response.json()) as { tag_name: string }
  return data.tag_name
}

const newerVersion = (latestVersion: string, currentVersion: string): boolean => {
  if (!latestVersion) return false
  if (!currentVersion) return true
  const latest = latestVersion.replace(/^v/, '')
  const current = currentVersion.replace(/^v/, '')
  return semver.gt(latest, current)
}

const updateAvailable = async (repository: string, currentVersion: string): Promise<boolean> => {
  const latestTag = await resolveLatestTag(repository)
  return newerVersion(latestTag, currentVersion)
}

const downloadAndExtract = async (url: string, destination: string): Promise<void> => {
  const response = await fetch(url, {
    headers: getGitHubHeaders(),
    redirect: 'follow',
  })
  if (!response.ok) {
    throw Object.assign(new Error(`Download failed: ${String(response.status)}`), { statusCode: response.status })
  }
  if (!response.body) {
    throw new Error('Empty response body')
  }

  await mkdir(destination, { recursive: true })

  if (url.endsWith('.zip')) {
    const tmpFile = path.join(destination, '_download.zip')
    const fileStream = createWriteStream(tmpFile)
    await pipeline(response.body, fileStream)
    try {
      if (isWindows()) {
        await execFile('powershell.exe', [
          '-NoProfile',
          '-Command',
          `Expand-Archive -Force -Path '${tmpFile}' -DestinationPath '${destination}'`,
        ])
      } else {
        await execFile('unzip', ['-o', tmpFile, '-d', destination])
      }
    } finally {
      await unlink(tmpFile)
    }
  } else {
    const tmpFile = path.join(destination, '_download.tar.gz')
    const fileStream = createWriteStream(tmpFile)
    await pipeline(response.body, fileStream)
    try {
      const extractStream = unpackTar(destination)
      await pipeline(createReadStream(tmpFile), createGunzip(), extractStream)
    } finally {
      await unlink(tmpFile)
    }
  }
}

const isVersionOutdated = async ({
  currentVersion,
  latestVersion,
  packageName,
}: {
  currentVersion: string
  latestVersion?: string | undefined
  packageName: string
}): Promise<boolean> => {
  if (latestVersion) {
    return newerVersion(latestVersion, currentVersion)
  }
  return await updateAvailable(getRepository({ packageName }), currentVersion)
}

export const shouldFetchLatestVersion = async ({
  binPath,
  execArgs,
  execName,
  latestVersion,
  packageName,
  pattern,
}: {
  binPath: string
  execArgs: string[]
  execName: string
  latestVersion?: string | undefined
  packageName: string
  pattern: string
}): Promise<boolean> => {
  const execPath = path.join(binPath, getExecName({ execName }))

  const exists = await isexe(execPath, { ignoreErrors: true })
  if (!exists) {
    return true
  }

  const { stdout } = await execFile(execPath, execArgs)

  if (!stdout) {
    return false
  }

  const match = stdout.match(new RegExp(pattern))
  if (!match) {
    return false
  }

  try {
    const [, currentVersion] = match
    const outdated = await isVersionOutdated({
      packageName,
      currentVersion,
      latestVersion,
    })
    return outdated
  } catch (error_) {
    if (exists) {
      log(NETLIFYDEVWARN, `failed checking for new version of '${packageName}'. Using existing version`)
      return false
    }
    throw error_
  }
}

export const getArch = () => {
  switch (process.arch) {
    case 'x64':
      return 'amd64'
    case 'ia32':
      return '386'
    default:
      return process.arch
  }
}

export const fetchLatestVersion = async ({
  destination,
  execName,
  extension,
  latestVersion,
  packageName,
}: {
  destination: string
  execName: string
  extension: string
  latestVersion?: string | undefined
  packageName: string
}): Promise<void> => {
  const win = isWindows()
  const arch = getArch()
  const platform = win ? 'windows' : process.platform
  const pkgName = `${execName}-${platform}-${arch}.${extension}`
  const repository = getRepository({ packageName })

  const version = latestVersion ?? (await resolveLatestTag(repository))
  const url = `https://github.com/${repository}/releases/download/${version}/${pkgName}`

  try {
    await downloadAndExtract(url, destination)
  } catch (error_) {
    if (error_ != null && typeof error_ === 'object' && 'statusCode' in error_ && error_.statusCode === 404) {
      const createIssueLink = new URL('https://github.com/netlify/cli/issues/new')
      createIssueLink.searchParams.set('assignees', '')
      createIssueLink.searchParams.set('labels', 'type: bug')
      createIssueLink.searchParams.set('template', 'bug_report.md')
      createIssueLink.searchParams.set(
        'title',
        `${execName} is not supported on ${platform} with CPU architecture ${arch}`,
      )

      const issueLink = getTerminalLink('Create a new CLI issue', createIssueLink.href)

      return logAndThrowError(`The operating system ${platform} with the CPU architecture ${arch} is currently not supported!

Please open up an issue on our CLI repository so that we can support it:
${issueLink}`)
    }
    return logAndThrowError(error_)
  }
}
