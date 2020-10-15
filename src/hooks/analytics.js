const { track } = require('../utils/telemetry')

const hook = function (options) {
  track(options.eventName, options.payload)
}
module.exports = hook
