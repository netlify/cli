import fs from 'node:fs'
import path from 'node:path'
import { sync as writeFileAtomicSync } from 'write-file-atomic'
import { getPathInHome } from '../../lib/settings.js'
import type { JSONValue, StorageAdapter } from './storage-adapter.js'

export class AtomicDiskStorageAdapter implements StorageAdapter {
  #storagePath: string

  public constructor({ storagePath = getPathInHome(['config.json']) }: { storagePath?: string } = {}) {
    this.#storagePath = storagePath
  }

  public read(): JSONValue {
    let raw: string
    try {
      raw = fs.readFileSync(this.#storagePath, 'utf8')
    } catch (err) {
      if (err instanceof Error && 'code' in err) {
        if (err.code === 'ENOENT') {
          return {}
        }
      }
      throw err
    }

    try {
      return JSON.parse(raw) as JSONValue
    } catch {
      // The existing configuration is invalid and will always fail parse. Empty it out so the user
      // can recover.
      writeFileAtomicSync(this.#storagePath, '', { mode: 0o0600 })
      return {}
    }
  }

  public write(value: JSONValue) {
    fs.mkdirSync(path.dirname(this.#storagePath), { mode: 0o0700, recursive: true })
    writeFileAtomicSync(this.#storagePath, JSON.stringify(value, undefined, '\t'), { mode: 0o0600 })
  }
}
