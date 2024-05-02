import pTimeout from 'p-timeout'
import kill from 'tree-kill'

const PROCESS_EXIT_TIMEOUT = 5e3

export const killProcess = async (ps) => {
  kill(ps.pid)
  await pTimeout(
    ps.catch(() => {}),
    {
      milliseconds: PROCESS_EXIT_TIMEOUT,
      fallback: () => {},
    },
  )
}
