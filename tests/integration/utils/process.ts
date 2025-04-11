import pTimeout from 'p-timeout'
import kill from 'tree-kill'
import type execa from 'execa'

const PROCESS_EXIT_TIMEOUT = 5e3

export const killProcess = async (ps: execa.ExecaChildProcess): Promise<void> => {
  if (ps.pid === undefined) {
    throw new Error('process.pid is empty; cannot kill a process that is not started')
  }

  kill(ps.pid)
  await pTimeout(
    ps.catch(() => {}),
    {
      milliseconds: PROCESS_EXIT_TIMEOUT,
      fallback: () => {},
    },
  )
}
