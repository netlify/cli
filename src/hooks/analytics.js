const { track } = require('../utils/telemetry')

const hook = async function(options) {
  track(options.eventName, options.payload)
}
module.exports = hook
