const { track } = require("@netlify/cli-utils/src/utils/telemetry");

const hook = async function (options) {
  track(options.eventName, options.payload)
}
module.exports = hook
