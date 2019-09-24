const header = require('../utils/header')
const globalConfig = require('../utils/global-config')
const { track } = require('../utils/telemetry')

module.exports = async context => {
  // Enable/disable telemetry Global flags. TODO refactor where these fire
  if (context.id === '--telemetry-disable') {
    globalConfig.set('telemetryDisabled', true)
    console.log('Netlify telemetry has been disabled')
    console.log('You can renable it anytime with the --telemetry-enable flag')
    track('user_telemetryDisabled', {
      force: true
    })
    process.exit() // eslint-disable-line
  }
  if (context.id === '--telemetry-enable') {
    globalConfig.set('telemetryDisabled', false)
    console.log('Netlify telemetry has been enabled')
    console.log('You can disable it anytime with the --telemetry-disable flag')
    track('user_telemetryEnabled', {
      force: true
    })
    process.exit() // eslint-disable-line
  }

  header(context)
}
