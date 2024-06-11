import { join } from 'path'
import { fileURLToPath } from 'url'

import type { NodeOptions } from 'execa'
import { copy } from 'fs-extra'
import { temporaryDirectory } from 'tempy'
import { afterAll, afterEach, beforeAll, beforeEach, describe } from 'vitest'

import { callCli } from './call-cli.js'
import { DevServer, startDevServer } from './dev-server.ts'
import { MockApi, Route, getCLIOptions, startMockApi } from './mock-api-vitest.js'
import { SiteBuilder } from './site-builder.ts'

const FIXTURES_DIRECTORY = fileURLToPath(new URL('../__fixtures__/', import.meta.url))
const HOOK_TIMEOUT = 30_000

interface MockApiOptions {
  routes: Route[]
  silent?: boolean
}

export interface FixtureTestContext {
  fixture: Fixture
  devServer?: DevServer
  mockApi?: MockApi
}

type LifecycleHook = (context: FixtureTestContext) => Promise<void> | void

export interface FixtureOptions {
  devServer?: boolean | { serve?: boolean; args?: string[] }
  mockApi?: MockApiOptions
  /**
   * Executed after fixture setup, but before tests run
   */
  setup?: LifecycleHook
  /**
   * Executed after fixture setup, after dev is started, but before tests run
   */
  setupAfterDev?: LifecycleHook
  /**
   * Executed before fixture is cleaned up
   */
  teardown?: LifecycleHook
}

interface CallCliOptions {
  execOptions?: NodeOptions<string>
  offline?: boolean
  parseJson?: boolean
}

interface FixtureSettings {
  apiUrl?: string
}

export class Fixture {
  /**
   * The relative path within the __fixtures__ directory
   */
  fixturePath: string
  /**
   * The temporary directory where the test is run
   */
  directory: string
  options: FixtureSettings
  builder: SiteBuilder

  private constructor(fixturePath: string, directory: string, options?: FixtureSettings) {
    this.fixturePath = fixturePath
    this.directory = directory
    this.options = options ?? {}
    this.builder = new SiteBuilder(directory)
  }

  static async create(fixturePath: string, options?: FixtureSettings): Promise<Fixture> {
    const fixture = new Fixture(fixturePath, temporaryDirectory(), options)

    await copy(join(FIXTURES_DIRECTORY, fixturePath), fixture.directory)

    return fixture
  }

  /**
   * Removes the temporary directory
   */
  async cleanup(): Promise<void> {
    await this.builder.cleanup()
  }

  async callCli(args: string[], options: CallCliOptions & { parseJson: true }): Promise<Record<string, unknown>>
  async callCli(args: string[], options?: CallCliOptions & { parseJson?: false }): Promise<string>
  /**
   * Calls the CLI with a max timeout inside the fixture directory.
   * If the `parseJson` argument is specified then the result will be converted into an object.
   * @param {string[]} args
   * @param {any} options
   * @returns {Promise<string|object>}
   */
  async callCli(
    args: string[],
    { execOptions = {}, offline = true, parseJson = false }: CallCliOptions = {},
  ): Promise<Record<string, unknown> | string> {
    let cliOptions: NodeOptions<string> = execOptions
    if (this.options.apiUrl) {
      cliOptions = getCLIOptions({ apiUrl: this.options.apiUrl, env: execOptions.env })
    }

    // @ts-expect-error we do not care it is readonly here
    cliOptions.cwd = this.directory

    if (offline) {
      args.push('--offline')
    }

    return await callCli(args, cliOptions, parseJson)
  }
}

type TestFactory = () => Promise<void> | void

export async function setupFixtureTests(fixturePath: string, factory: TestFactory): Promise<void>
export async function setupFixtureTests(
  fixturePath: string,
  options: FixtureOptions,
  factory: TestFactory,
): Promise<void>
export async function setupFixtureTests(
  fixturePath: string,
  optionsOrFactory: FixtureOptions | TestFactory,
  factoryInput?: TestFactory,
): Promise<void> {
  let factory: TestFactory
  let options: FixtureOptions = {}

  if (typeof optionsOrFactory === 'function') {
    factory = optionsOrFactory
  } else {
    options = optionsOrFactory
    factory = factoryInput as TestFactory
  }

  describe(`fixture: ${fixturePath}`, async () => {
    let devServer: any
    let mockApi: MockApi | undefined
    let fixture: Fixture

    beforeAll(async () => {
      if (options.mockApi) mockApi = await startMockApi(options.mockApi)
      fixture = await Fixture.create(fixturePath, { apiUrl: mockApi?.apiUrl })

      await options.setup?.({ fixture, mockApi })

      if (options.devServer) {
        const args = ['--country', 'DE']
        if (typeof options.devServer === 'object' && options.devServer.args) {
          args.push(...options.devServer.args)
        }

        console.log(`apiUrl: ${mockApi?.apiUrl}`)
        console.log(`args: ${args}`)

        devServer = await startDevServer({
          serve: typeof options.devServer === 'object' && options.devServer.serve,
          cwd: fixture.directory,
          offline: !mockApi,
          args,
          env: {
            NETLIFY_API_URL: mockApi?.apiUrl,
            NETLIFY_SITE_ID: 'foo',
            NETLIFY_AUTH_TOKEN: 'fake-token',
          },
        })

        await options.setupAfterDev?.({ fixture, mockApi, devServer })
      }
    }, HOOK_TIMEOUT)

    beforeEach<FixtureTestContext>((context) => {
      if (fixture) context.fixture = fixture
      if (devServer) context.devServer = devServer
      if (mockApi) {
        mockApi.clearRequests()
        context.mockApi = mockApi
      }
    })

    afterEach<FixtureTestContext>((context) => {
      if (devServer && context.task.result?.state === 'fail') {
        console.log(devServer.output)
      }
    })

    await factory()

    afterAll(async () => {
      await options.teardown?.({ devServer, fixture, mockApi })

      if (devServer) await devServer.close()
      if (mockApi) await mockApi.close()
      if (fixture) await fixture.cleanup()
    }, HOOK_TIMEOUT)
  })
}
