import * as path from 'node:path'
import * as os from 'node:os'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'

const uniqueString = () => crypto.randomBytes(8).toString('hex')

const tempDir = os.tmpdir()

export function temporaryFile({ name, extension }: { name?: string; extension?: string } = {}): string {
  if (name) {
    if (typeof extension  === 'string') {
      throw new Error('The `name` and `extension` options are mutually exclusive')
    }
    return path.join(tempDir, name)
  }

  const baseName = uniqueString()
  const ext = extension ? '.' + extension.replace(/^\./, '') : ''
  return path.join(tempDir, baseName + ext)
}

export function temporaryDirectory({ prefix = '' } = {}): string {
  const directory = path.join(tempDir, prefix + uniqueString())
  fs.mkdirSync(directory)
  return directory
}
