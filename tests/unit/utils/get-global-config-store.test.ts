import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, beforeEach, expect, it, vi } from 'vitest'
import { vol } from 'memfs'

import { getLegacyPathInHome, getPathInHome } from '../../../src/lib/settings.js'
import getGlobalConfigStore, {
  GlobalConfigStore,
  resetConfigCache,
} from '../../../src/utils/get-global-config-store.js'

// Mock filesystem calls
vi.mock('fs')
vi.mock('fs/promises')
vi.mock('write-file-atomic')

const configFilePath = getPathInHome(['config.json'])
const configPath = path.dirname(configFilePath)
// eslint-disable-next-line @typescript-eslint/no-deprecated
const legacyConfigFilePath = getLegacyPathInHome(['config.json'])
const legacyConfigPath = path.dirname(legacyConfigFilePath)

describe('getGlobalConfig', () => {
  beforeEach(() => {
    vol.reset()

    vol.mkdirSync(configPath, { recursive: true })
    vol.mkdirSync(legacyConfigPath, { recursive: true })

    // reset the memoized config for the tests
    resetConfigCache()
  })

  it('returns an empty object when the legacy configuration file is not valid JSON', async () => {
    await fs.writeFile(legacyConfigFilePath, 'NotJson')

    await expect(getGlobalConfigStore()).resolves.not.toThrowError()
  })

  it('merges legacy configuration options with new configuration options (preferring new config options)', async () => {
    const legacyConfig = { someOldKey: 'someOldValue', overrideMe: 'oldValue' }
    const newConfig = { overrideMe: 'newValue' }
    await fs.writeFile(legacyConfigFilePath, JSON.stringify(legacyConfig))
    await fs.writeFile(configFilePath, JSON.stringify(newConfig))

    const globalConfig = await getGlobalConfigStore()

    expect(globalConfig.get('someOldKey')).toBe(legacyConfig.someOldKey)
    expect(globalConfig.get('overrideMe')).toBe(newConfig.overrideMe)
  })

  it("creates a config store file in netlify's config dir if none exists and stores new values", async () => {
    // Remove config dirs
    await fs.rm(getPathInHome([]), { force: true, recursive: true })

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await fs.rm(getLegacyPathInHome([]), { force: true, recursive: true })
    const globalConfig = await getGlobalConfigStore()
    globalConfig.set('newProp', 'newValue')
    const configFile = JSON.parse(await fs.readFile(configFilePath, 'utf-8')) as Record<string, unknown>

    expect(globalConfig.all).toEqual(configFile)
  })
})

describe('ConfigStore', () => {
  beforeEach(() => {
    vol.reset()
  })

  it('merges defaults into the configuration file, when provided', async () => {
    await fs.mkdir(configPath, { recursive: true })

    const defaults = { someOldKey: 'someOldValue', overrideMe: 'oldValue' }
    const config = { overrideMe: 'newValue' }
    await fs.writeFile(configFilePath, JSON.stringify(config))

    const before: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))
    expect(before).toEqual(config)

    new GlobalConfigStore({ defaults })

    const after: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))
    expect(after).toEqual({
      someOldKey: 'someOldValue',
      overrideMe: 'newValue',
    })
  })

  describe('#all', () => {
    it('returns the entire configuration', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const config = { a: 'value' }
      await fs.writeFile(configFilePath, JSON.stringify(config))

      const store = new GlobalConfigStore()

      expect(store.all).toEqual(config)
    })

    it('works when no configuration file exists', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()

      expect(store.all).toEqual({})
    })

    it('works when no configuration directory exists', () => {
      const store = new GlobalConfigStore()

      expect(store.all).toEqual({})
    })
  })

  describe('#get', () => {
    it('returns a single configuration value in the config', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const config = { a: 'value' }
      await fs.writeFile(configFilePath, JSON.stringify(config))

      const store = new GlobalConfigStore()

      expect(store.get('a')).toBe('value')
    })

    it('returns undefined when no configuration file exists', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()

      expect(store.get('a')).toBe(undefined)
    })

    it('returns undefined when no configuration directory exists', () => {
      const store = new GlobalConfigStore()

      expect(store.get('a')).toBe(undefined)
    })
  })

  describe('#set', () => {
    it('updates an existing configuration file', async () => {
      await fs.mkdir(configPath, { recursive: true })
      await fs.writeFile(configFilePath, JSON.stringify({ a: 'value' }))

      const store = new GlobalConfigStore()
      store.set('b', 'another value')
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual({ a: 'value', b: 'another value' })
    })

    it('creates a configuration file when one does not exist', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()
      store.set('a', 'fresh start')
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual({ a: 'fresh start' })
    })

    it('sets nested values', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()
      store.set('a.new', 'hope')
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual({ a: { new: 'hope' } })
    })

    it('succeeds when no configuration directory exists', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()
      store.set('a.new', 'hope')
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual({ a: { new: 'hope' } })
    })
  })
})
