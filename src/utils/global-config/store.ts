import { getProperty, setProperty } from 'dot-prop'
import type { Get, ReadonlyDeep, SimplifyDeep } from 'type-fest'
import type { StorageAdapter } from './storage-adapter.js'
import { AtomicDiskStorageAdapter } from './storage-adapter-atomic-disk.js'
import { type GlobalConfig as MutableGlobalConfig, mustParseGlobalConfig } from './schema.js'

/**
 * The Netlify CLI's persistent configuration state. This state includes information that should be
 * persisted across CLI invocations.
 *
 * This type is read-only and represents the current state of the configuration on disk. To modify
 * the configuration, use the GlobalConfigStore interface.
 *
 * This state is stored in the user's platform-specific configuration directory (e.g.
 * `$XDG_CONFIG_HOME/netlify/config.json`, `$HOME/Library/Preferences/netlify/config.json`, etc.).
 */
export type GlobalConfig = SimplifyDeep<ReadonlyDeep<MutableGlobalConfig>>

export class GlobalConfigStore {
  #store: StorageAdapter

  public constructor({ store }: { store?: StorageAdapter } = {}) {
    this.#store = store ?? new AtomicDiskStorageAdapter()
  }

  public get all(): GlobalConfig {
    return this.getConfig()
  }

  public set(key: string, value: unknown): void {
    const config = this.getMutableConfig()
    const updatedConfig = setProperty(config, key, value)
    this.writeConfig(updatedConfig)
  }

  public get<Path extends string>(
    path: Path,
  ): unknown extends Get<GlobalConfig, Path> ? undefined : Get<GlobalConfig, Path> {
    return getProperty(this.getConfig(), path)
  }

  private getConfig(): GlobalConfig {
    // TODO(ndhoule): Use parseGlobalConfig instead and gracefully recover from failure
    return mustParseGlobalConfig(this.#store.read())
  }

  private getMutableConfig(): MutableGlobalConfig {
    return this.getConfig() as MutableGlobalConfig
  }

  private writeConfig(value: GlobalConfig) {
    this.#store.write(value)
  }
}
