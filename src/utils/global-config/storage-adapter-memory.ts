import type { JSONValue, StorageAdapter } from './storage-adapter.js'

export class MemoryStorageAdapter implements StorageAdapter {
  #data: JSONValue

  public constructor(initialData?: JSONValue) {
    this.#data = structuredClone(initialData ?? {})
  }

  public read(): JSONValue {
    return structuredClone(this.#data)
  }

  public write(value: JSONValue) {
    this.#data = structuredClone(value)
  }
}
