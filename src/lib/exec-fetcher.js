const fs = require('fs-extra')
const path = require('path')
const execa = require('execa')
const { fetchLatest, updateAvailable } = require('gh-release-fetch')
const { NETLIFYDEVWARN } = require('../utils/logo')

const isWindows = () => {
  return process.platform === 'win32'
}

const getRepository = ({ packageName }) => `netlify/${packageName}`

const getExecName = ({ execName }) => {
  return isWindows() ? `${execName}.exe` : execName
}

const isExe = (mode, gid, uid) => {
  if (isWindows()) {
    return true
  }

  const isGroup = gid ? process.getgid && gid === process.getgid() : true
  const isUser = uid ? process.getuid && uid === process.getuid() : true

  return Boolean(mode & 0o0001 || (mode & 0o0010 && isGroup) || (mode & 0o0100 && isUser))
}

const execExist = async binPath => {
  const binExists = await fs.exists(binPath)
  if (!binExists) {
    return false
  }
  const stat = fs.statSync(binPath)
  return stat && stat.isFile() && isExe(stat.mode, stat.gid, stat.uid)
}

const isVersionOutdated = async ({ packageName, currentVersion }) => {
  const outdated = await updateAvailable(getRepository({ packageName }), currentVersion)
  return outdated
}

const shouldFetchLatestVersion = async ({ binPath, packageName, execName, execArgs, pattern, log }) => {
  const execPath = path.join(binPath, getExecName({ execName }))

  const exists = await execExist(execPath)
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
    const outdated = await isVersionOutdated({
      packageName,
      currentVersion: match[1],
    })
    return outdated
  } catch (e) {
    if (exists) {
      log(NETLIFYDEVWARN, `failed checking for new version of '${packageName}'. Using existing version`)
      return false
    } else {
      throw e
    }
  }
}

const fetchLatestVersion = async ({ packageName, execName, destination, extension }) => {
  const win = isWindows()
  const platform = win ? 'windows' : process.platform
  const release = {
    repository: getRepository({ packageName }),
    package: `${execName}-${platform}-amd64.${extension}`,
    destination,
    extract: true,
  }

  await fetchLatest(release)
}

module.exports = { getExecName, shouldFetchLatestVersion, fetchLatestVersion }
