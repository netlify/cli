// @ts-check
import { rm } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'

import { copy } from 'fs-extra'
import { temporaryDirectory } from 'tempy'
import { afterAll, beforeAll, beforeEach } from 'vitest'

import callCli from './call-cli.cjs'
import { startDevServer } from './dev-server.cjs'

const FIXTURES_DIRECTORY = fileURLToPath(new URL('../__fixtures__/', import.meta.url))
const HOOK_TIMEOUT = 30_000

/**
 * @param {Object} options
 * @param {Function} factory
 * @return {Promise<void>}
 */
export const setupFixtureTests = async function (options, factory) {
  /**
   * @type {any}
   */
  let devServer
  /**
   * @type {Fixture}
   */
  let fixture

  beforeAll(async () => {
    if (options.fixture) fixture = await Fixture.create(options.fixture)
    if (options.devServer) devServer = await startDevServer({ cwd: fixture.directory, args: ['--offline'] })
  }, HOOK_TIMEOUT)

  beforeEach((context) => {
    if (fixture) context.fixture = fixture
    if (devServer) context.devServer = devServer
  })

  afterAll(async () => {
    if (devServer) await devServer.close()
    if (fixture) await fixture.cleanup()
  }, HOOK_TIMEOUT)

  await factory()
}

export class Fixture {
  fixturePath
  directory

  /**
   * @private
   * @param {string} fixturePath
   */
  constructor(fixturePath) {
    this.fixturePath = fixturePath
  }

  /**
   * @param {string} fixturePath
   * @return {Promise<Fixture>}
   */
  static async create(fixturePath) {
    const fixture = new Fixture(fixturePath)

    fixture.directory = temporaryDirectory()
    await copy(join(FIXTURES_DIRECTORY, fixturePath), fixture.directory)

    return fixture
  }

  async cleanup() {
    try {
      await rm(this.directory, { force: true, recursive: true })
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Calls the CLI with a max timeout inside the fixture directory.
   * If the `parseJson` argument is specified then the result will be converted into an object.
   * @param {string[]} args
   * @param {any} options
   * @returns {Promise<string|object>}
   */
  async callCli(args, { execOptions = {}, offline = true, parseJson = false } = {}) {
    execOptions.cwd = this.directory

    if (offline) {
      args.push('--offline')
    }

    return await callCli(args, execOptions, parseJson)
  }
}
