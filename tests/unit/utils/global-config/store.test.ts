import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, beforeEach, expect, it, vi } from 'vitest'
import { vol } from 'memfs'

import { getPathInHome } from '../../../../src/lib/settings.js'
import { GlobalConfigStore } from '../../../../src/utils/global-config/store.js'

// Mock filesystem calls
vi.mock('fs')
vi.mock('fs/promises')
vi.mock('write-file-atomic')

const configFilePath = getPathInHome(['config.json'])
const configPath = path.dirname(configFilePath)

describe('GlobalConfigStore', () => {
  beforeEach(() => {
    vol.reset()
  })

  it("creates a config store file in netlify's config dir if none exists and stores new values", async () => {
    // Remove config dirs
    await fs.rm(getPathInHome([]), { force: true, recursive: true })

    const globalConfig = new GlobalConfigStore()
    globalConfig.set('userId', 'newValue')
    const configFile = JSON.parse(await fs.readFile(configFilePath, 'utf-8')) as unknown

    expect(globalConfig.all).toEqual(configFile)
  })

  describe('#all', () => {
    it('returns the entire configuration', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const config = {
        cliId: 'some-cli-id',
        telemetryDisabled: true,
        userId: 'some-user-id',
        users: {
          'some-user-id': {
            id: 'some-user-id',
            auth: {
              github: {},
            },
          },
        },
      }
      await fs.writeFile(configFilePath, JSON.stringify(config))

      const store = new GlobalConfigStore()

      expect(store.all).toEqual(config)
    })

    it('works when no configuration file exists', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()

      expect(store.all).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          cliId: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          telemetryDisabled: expect.any(Boolean),
          users: {},
        }),
      )
    })

    it('works when no configuration directory exists', () => {
      const store = new GlobalConfigStore()

      expect(store.all).toEqual(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          cliId: expect.any(String),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          telemetryDisabled: expect.any(Boolean),
          users: {},
        }),
      )
    })
  })

  describe('#get', () => {
    it('returns a single configuration value in the config', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const config = { userId: 'value' }
      await fs.writeFile(configFilePath, JSON.stringify(config))

      const store = new GlobalConfigStore()

      expect(store.get('userId')).toBe('value')
    })

    it('returns undefined when no configuration file exists', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()

      expect(store.get('userId')).toBe(undefined)
    })

    it('returns undefined when no configuration directory exists', () => {
      const store = new GlobalConfigStore()

      expect(store.get('userId')).toBe(undefined)
    })
  })

  describe('#set', () => {
    it('updates an existing configuration file', async () => {
      await fs.mkdir(configPath, { recursive: true })
      await fs.writeFile(configFilePath, JSON.stringify({ userId: 'value' }))

      const store = new GlobalConfigStore()
      store.set('cliId', 'another value')
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual(expect.objectContaining({ userId: 'value', cliId: 'another value' }))
    })

    it('creates a configuration file when one does not exist', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()
      store.set('userId', 'new file')
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual(expect.objectContaining({ userId: 'new file' }))
    })

    it('creates a configuration directory when one does not exist', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()
      store.set('userId', 'new directory')
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual(expect.objectContaining({ userId: 'new directory' }))
    })

    it('sets nested values', async () => {
      await fs.mkdir(configPath, { recursive: true })

      const store = new GlobalConfigStore()
      store.set('users.some-user-id', { id: 'some-user-id' })
      const data: unknown = JSON.parse(await fs.readFile(configFilePath, 'utf8'))

      expect(data).toEqual(expect.objectContaining({ users: { 'some-user-id': { id: 'some-user-id' } } }))
    })
  })
})
