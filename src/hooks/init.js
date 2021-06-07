const process = require('process')

const getGlobalConfig = require('../utils/get-global-config')
const header = require('../utils/header')
const { track } = require('../utils/telemetry')

module.exports = async function initHooks(context) {
  const globalConfig = await getGlobalConfig()
  // Enable/disable telemetry Global flags. TODO refactor where these fire
  if (context.id === '--telemetry-disable') {
    globalConfig.set('telemetryDisabled', true)
    console.log('Netlify telemetry has been disabled')
    console.log('You can renable it anytime with the --telemetry-enable flag')
    process.exit()
  }
  if (context.id === '--telemetry-enable') {
    globalConfig.set('telemetryDisabled', false)
    console.log('Netlify telemetry has been enabled')
    console.log('You can disable it anytime with the --telemetry-disable flag')
    await track('user_telemetryEnabled')
    process.exit()
  }

  if (
    process.argv.length > 3 &&
    ['-v', '--version', 'version'].includes(process.argv[2]) &&
    process.argv[3] === '--verbose'
  ) {
    console.log(`────────────────────┐
 Environment Info   │
────────────────────┘`)

    // performance optimization - load envinfo on demand
    // eslint-disable-next-line node/global-require
    const envinfo = require('envinfo')
    const data = await envinfo.run({
      System: ['OS', 'CPU'],
      Binaries: ['Node', 'Yarn', 'npm'],
      Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
      npmGlobalPackages: ['netlify-cli'],
    })
    console.log(data)
  }

  header(context)
}
