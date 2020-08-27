const path = require('path')
const execa = require('execa')
const chalk = require('chalk')
const { NETLIFYDEVLOG, NETLIFYDEVERR } = require('./logo')
const { getPathInHome } = require('../lib/settings')
const { shouldFetchLatestVersion, fetchLatestVersion } = require('../lib/exec-fetcher')

const PACKAGE_NAME = 'traffic-mesh'

const getBinPath = () => getPathInHome([PACKAGE_NAME, 'bin'])

const installTrafficMesh = async ({ log }) => {
  try {
    const binPath = getBinPath()
    const shouldFetch = await shouldFetchLatestVersion({
      binPath,
      packageName: PACKAGE_NAME,
      execArgs: ['--version'],
      pattern: '\\sv(.+)',
    })
    if (!shouldFetch) {
      return
    }

    log(`${NETLIFYDEVLOG} Installing Traffic Mesh`)

    await fetchLatestVersion({
      packageName: PACKAGE_NAME,
      destination: binPath,
    })
  } catch (e) {
    // This is expected to fail until we publish releases in a public repo
    console.error(`${NETLIFYDEVERR}`, e)
  }
}

const startForwardServer = async ({ log }) => {
  await installTrafficMesh({ log })

  const execPath = path.join(getBinPath(), PACKAGE_NAME)
  const args = ['--version']
  await execa(execPath, args, { stdio: 'inherit' })
}

module.exports = { startForwardServer }
