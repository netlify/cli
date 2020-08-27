const fs = require('fs-extra')
const path = require('path')
const execa = require('execa')
const { fetchLatest, updateAvailable } = require('gh-release-fetch')

const isWindows = () => {
  return process.platform === 'win32'
}

const getRepository = ({ packageName }) => `netlify/${packageName}`

const getExecName = ({ packageName }) => {
  const execName = isWindows() ? `${packageName}.exe` : packageName
  return execName
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

const shouldFetchLatestVersion = async ({ binPath, packageName }) => {
  const execName = getExecName({ packageName })
  const execPath = path.join(binPath, execName)

  const exists = await execExist(execPath)
  if (!exists) {
    return true
  }

  const { stdout } = await execa(execPath, ['version'])
  if (!stdout) {
    return false
  }

  const regex = new RegExp(`${packageName}\\/v?([^\\s]+)`)
  const match = stdout.match(regex)
  if (!match) {
    return false
  }

  return isVersionOutdated({
    packageName,
    currentVersion: match[1],
  })
}

const fetchLatestVersion = async ({ packageName, destination }) => {
  const win = isWindows()
  const platform = win ? 'windows' : process.platform
  const extension = win ? 'zip' : 'tar.gz'
  const release = {
    repository: getRepository({ packageName }),
    package: `${packageName}-${platform}-amd64.${extension}`,
    destination,
    extract: true,
  }

  await fetchLatest(release)
}

module.exports = { getExecName, shouldFetchLatestVersion, fetchLatestVersion }
