// @ts-check
const path = require('path')
const process = require('process')
const { stringify } = require('querystring')

const { fetchLatest, fetchVersion, newerVersion, updateAvailable } = require('gh-release-fetch')
const isExe = require('isexe')
const terminalLink = require('terminal-link')

// cannot directly import from ../utils as it would create a circular dependency.
// the file `src/utils/live-tunnel.js` depends on this file
const { NETLIFYDEVWARN, chalk, error, log } = require('../utils/command-helpers')
const execa = require('../utils/execa')

const isWindows = () => process.platform === 'win32'

const getRepository = ({ packageName }) => `netlify/${packageName}`

const getExecName = ({ execName }) => (isWindows() ? `${execName}.exe` : execName)

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

const shouldFetchLatestVersion = async ({ binPath, execArgs, execName, latestVersion, packageName, pattern }) => {
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

const fetchLatestVersion = async ({ destination, execName, extension, latestVersion, packageName }) => {
  const win = isWindows()
  const platform = win ? 'windows' : process.platform
  const pkgName = `${execName}-${platform}-${process.arch}.${extension}`

  const release = {
    repository: getRepository({ packageName }),
    package: pkgName,
    destination,
    extract: true,
  }

  const options = getOptions()
  const fetch = latestVersion
    ? fetchVersion({ ...release, version: latestVersion }, options)
    : fetchLatest(release, options)

  try {
    await fetch
  } catch {
    const qs = stringify({
      assignees: '',
      labels: 'type: bug',
      template: 'bug_report.md',
      title: `${execName} is not supported on ${platform} with CPU architecture ${process.arch}`,
    })
    const issueLink = terminalLink('Create a new CLI issue', `https://github.com/netlify/cli/issues/new?${qs}`)

    error(`The operating system ${chalk.cyan(platform)} with the CPU architecture ${chalk.cyan(
      process.arch,
    )} is currently not supported!

Please open up an issue on our CLI repository so that we can support it:
${issueLink}`)
  }
}

module.exports = { getExecName, shouldFetchLatestVersion, fetchLatestVersion }
