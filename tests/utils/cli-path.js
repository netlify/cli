import process from 'process'

export const cliPath = new URL(`../../bin/${process.platform === 'win32' ? 'run.cmd' : 'run.js'}`, import.meta.url).pathname
