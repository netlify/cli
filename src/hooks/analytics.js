const { track } = require('../utils/telemetry')

const hook = function ({ eventName, payload }) {
  track(eventName, payload)
}
module.exports = hook
