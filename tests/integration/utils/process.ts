import pTimeout from 'p-timeout'
// @ts-expect-error TS(1259) FIXME: Module '"/home/ndhoule/dev/src/github.com/netlify/... Remove this comment to see the full error message
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
