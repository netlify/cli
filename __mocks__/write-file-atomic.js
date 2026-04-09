// eslint-disable-next-line no-undef, @typescript-eslint/no-require-imports
const { fs } = require('memfs')

export const sync = fs.writeFileSync
export default fs.writeFile
