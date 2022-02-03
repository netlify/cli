const pTimeout = require('p-timeout')
const kill = require('tree-kill')

const killProcess = async (ps) => {
  kill(ps.pid)
  await pTimeout(
    ps.catch(() => {}),
    PROCESS_EXIT_TIMEOUT,
    // don't reject on timeout
    () => {},
  )
}

const PROCESS_EXIT_TIMEOUT = 5e3

module.exports = { killProcess }
