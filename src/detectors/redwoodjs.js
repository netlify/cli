const { hasRequiredDeps, hasRequiredFiles } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 8910

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['redwood.toml'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@redwoodjs/core'])) return false

  /** everything below now assumes that we are within redwoodjs */

  return {
    framework: 'redwoodjs',
    // yarn is a requirement for RedwoodJS:
    // https://learn.redwoodjs.com/docs/tutorial/installation-starting-development
    command: 'yarn',
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs: [['rw', 'dev']],
    dist: 'web/dist',
    disableLocalServerPolling: true,
  }
}
