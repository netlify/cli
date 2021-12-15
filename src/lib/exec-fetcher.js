// @ts-check
import path from 'path'
import process from 'process'

import { fetchLatest, fetchVersion, newerVersion, updateAvailable } from 'gh-release-fetch'
import isExe from 'isexe'

// cannot directly import from ../utils as it would create a circular dependency.
// the file `src/utils/live-tunnel.js` depends on this file
import { NETLIFYDEVWARN, log } from '../utils/command-helpers.js'
import execa from '../utils/execa.js'

const isWindows = () => process.platform === 'win32'

const getRepository = ({ packageName }) => `netlify/${packageName}`

export const getExecName = ({ execName }) => (isWindows() ? `${execName}.exe` : execName)

const getOptions = () => {
  // this is used in out CI tests to avoid hitting GitHub API limit
  // when calling gh-release-fetch
  if (process.env.NETLIFY_TEST_GITHUB_TOKEN) {
    return {
      headers: { Authorization: `token ${process.env.NETLIFY_TEST_GITHUB_TOKEN}` },
    }
  }
}

const isVersionOutdated = async ({ currentVersion, latestVersion, packageName }) => {
  if (latestVersion) {
    return newerVersion(latestVersion, currentVersion)
  }
  const options = getOptions()
  const outdated = await updateAvailable(getRepository({ packageName }), currentVersion, options)
  return outdated
}

export const shouldFetchLatestVersion = async ({
  binPath,
  execArgs,
  execName,
  latestVersion,
  packageName,
  pattern,
}) => {
  const execPath = path.join(binPath, getExecName({ execName }))

  const exists = await isExe(execPath, { ignoreErrors: true })
  if (!exists) {
    return true
  }

  const { stdout } = await execa(execPath, execArgs)

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
  } catch (error) {
    if (exists) {
      log(NETLIFYDEVWARN, `failed checking for new version of '${packageName}'. Using existing version`)
      return false
    }
    throw error
  }
}

export const fetchLatestVersion = async ({ destination, execName, extension, latestVersion, packageName }) => {
  const win = isWindows()
  const platform = win ? 'windows' : process.platform
  const release = {
    repository: getRepository({ packageName }),
    package: `${execName}-${platform}-amd64.${extension}`,
    destination,
    extract: true,
  }

  const options = getOptions()
  await (latestVersion ? fetchVersion({ ...release, version: latestVersion }, options) : fetchLatest(release, options))
}
