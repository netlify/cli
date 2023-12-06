import path from 'path'
import { fileURLToPath } from 'url'

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const cliPath = path.resolve(__dirname, '../../../bin/run.js')
