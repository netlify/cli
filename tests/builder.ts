import tomlify from 'tomlify-j0.4'

import { addMockedFiles } from './fs'

type PluginNames = 'basic'

type ContextSettings = {
  command: string
}

type Config = {
  plugins?: {
    package: string
  }[]
  build?: ContextSettings
  context?: {
    production?: ContextSettings
    staging?: ContextSettings
  }
}

export class StateBuilder {
  private configPath = 'netlify.toml'
  private config: Config = {}
  private siteId = 'site_id'
  private skipBuilder = false

  setSiteId(siteId: string) {
    this.siteId = siteId

    return this
  }

  setConfigPath(configPath: string) {
    this.configPath = configPath

    return this
  }

  setConfig(config: Config) {
    this.config = config

    return this
  }

  addPlugin(plugin: PluginNames) {
    if (Array.isArray(this.config.plugins)) {
      this.config.plugins.push({
        package: `/tests/plugins/${plugin}`,
      })
    } else {
      this.config.plugins = [
        {
          package: `/tests/plugins/${plugin}`,
        },
      ]
    }
  }

  setBuildCommand(command: string) {
    this.config.build = {
      command,
      ...this.config.build,
    }

    return this
  }

  skipBuild() {
    this.skipBuilder = true

    return this
  }

  build() {
    if (this.skipBuilder) {
      return
    }
    let toMock = {
      '.netlify': {
        'state.json': JSON.stringify({
          siteId: this.siteId,
        }),
      },
    } as any

    if (typeof this.config !== 'undefined') {
      toMock = {
        ...toMock,
        [this.configPath]: tomlify.toToml(this.config),
      }
    }

    addMockedFiles({
      ...toMock,
    })
  }
}
