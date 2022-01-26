import { fileURLToPath } from 'url'

export const cliPath = fileURLToPath(new URL('../../bin/run.mjs', import.meta.url))
