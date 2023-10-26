import path from 'path'

const __dirname = new URL('.', import.meta.url).pathname

export const cliPath = path.resolve(__dirname, '../../../bin/run.mjs')
