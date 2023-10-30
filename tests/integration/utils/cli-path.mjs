import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const cliPath = path.resolve(__dirname, '../../../bin/run.mjs')
