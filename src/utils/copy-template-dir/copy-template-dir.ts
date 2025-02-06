// License for copy-template-dir.
// Original repository: https://github.com/yoshuawuyts/copy-template-dir

// The MIT License (MIT)

// Copyright (c) 2015 Yoshua Wuyts

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
// Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'

// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'maxstache... Remove this comment to see the full error message
import maxstache from 'maxstache'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'maxstache-stream... Remove this comment to see the full error message
import maxstacheStream from 'maxstache-stream'
import { readdirp, EntryInfo, ReaddirpStream } from 'readdirp'

const noop = (): void => undefined

// Remove a leading underscore
function removeUnderscore(filepath: string): string {
  const parts = filepath.split(path.sep)
  const filename = parts.pop()?.replace(/^_/, '') || ''
  return [...parts, filename].join(path.sep)
}

// Write a file to a directory
async function writeFile(outDir: string, vars: Record<string, string>, file: EntryInfo): Promise<void> {
  const fileName = file.path
  const inFile = file.fullPath
  const parentDir = path.dirname(file.path)
  const outFile = path.join(outDir, maxstache(removeUnderscore(fileName), vars))

  await fs.promises.mkdir(path.join(outDir, maxstache(parentDir, vars)), { recursive: true })

  const rs = fs.createReadStream(inFile)
  const ts = maxstacheStream(vars)
  const ws = fs.createWriteStream(outFile)

  await promisify(pipeline)(rs, ts, ws)
}

// High throughput template dir writes
export async function copyTemplateDir(srcDir: string, outDir: string, vars: any): Promise<string[]> {
  if (!vars) vars = noop

  assert.strictEqual(typeof srcDir, 'string')
  assert.strictEqual(typeof outDir, 'string')
  assert.strictEqual(typeof vars, 'object')

  await fs.promises.mkdir(outDir, { recursive: true })

  const rs: ReaddirpStream = readdirp(srcDir)
  const streams: Promise<void>[] = []
  const createdFiles: string[] = []

  rs.on('data', (file: EntryInfo) => {
    createdFiles.push(path.join(outDir, maxstache(removeUnderscore(file.path), vars)))
    streams.push(writeFile(outDir, vars, file))
  })

  await new Promise<void>((resolve, reject) => {
    rs.on('end', async () => {
      try {
        await Promise.all(streams)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
    rs.on('error', (error) => {
      reject(error)
    })
  })

  return createdFiles
}
