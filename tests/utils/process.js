import pTimeout from 'p-timeout'
import kill from 'tree-kill'

export const killProcess = async (ps) => {
  kill(ps.pid)
  await pTimeout(
    ps.catch(() => {}),
    PROCESS_EXIT_TIMEOUT,
    // don't reject on timeout
    () => {},
  )
}

const PROCESS_EXIT_TIMEOUT = 5e3
