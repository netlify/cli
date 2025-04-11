import path from 'path'
import { fileURLToPath } from 'url'

// @ts-expect-error TS(1343) FIXME: The 'import.meta' meta-property is only allowed wh... Remove this comment to see the full error message
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const cliPath = path.resolve(__dirname, '../../../bin/run.js')
