const path = require('path')
const pWaitFor = require('p-wait-for')
const flatten = require('lodash.flatten')
const debug = require('debug')('netlify-cli:deploy:util')

function existy(x) {
  return x != null
}

// Default filter when scanning for files
exports.defaultFilter = filename => {
  if (!existy(filename)) return false
  const n = path.basename(filename)
  switch (true) {
    case n === 'node_modules':
    case n.startsWith('.') && n !== '.well-known':
    case n.match(/(\/__MACOSX|\/\.)/):
      return false
    default:
      return true
  }
}

// normalize windows paths to unix paths
exports.normalizePath = relname => {
  return (
    relname
      .split(path.sep)
      // .map(segment => encodeURIComponent(segment)) // TODO Messes up for paths with @ in them
      .join('/')
  )
}

// Poll a deployId until its ready
exports.waitForDeploy = waitForDeploy
async function waitForDeploy(api, deployId, timeout) {
  let deploy // capture ready deploy during poll

  await pWaitFor(loadDeploy, {
    interval: 1000,
    timeout,
    message: 'Timeout while waiting for deploy'
  })

  return deploy

  async function loadDeploy() {
    const d = await api.getDeploy({ deployId })
    debug(`deploy state: ${d.state}`)
    if (d.state === 'ready') {
      deploy = d
      return true
    } else {
      return false
    }
  }
}

// Transform the fileShaMap and fnShaMap into a generic shaMap that file-uploader.js can use
exports.getUploadList = getUploadList
function getUploadList(required, shaMap) {
  return flatten(required.map(sha => shaMap[sha]))
}

// given a Stat object, return if its executable or not
// https://github.com/jokeyrhyme/is-executable.js without the io
exports.isExe = stat => {
  const { mode, gid, uid } = stat
  if (process.platform === 'win32') {
    return true
  }

  const isGroup = gid ? process.getgid && gid === process.getgid() : true
  const isUser = uid ? process.getuid && uid === process.getuid() : true

  return Boolean(mode & 0o0001 || (mode & 0o0010 && isGroup) || (mode & 0o0100 && isUser))
}
