const fs = require('fs')

const { flags: flagsLib } = require('@oclif/command')
const AsciiTable = require('ascii-table')
const dotenv = require('dotenv')
const isEmpty = require('lodash/isEmpty')

const Command = require('../../utils/command')

class EnvImportCommand extends Command {
  async run() {
    const { args, flags } = this.parse(EnvImportCommand)
    const { api, site } = this.netlify
    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'env:import',
      },
    })

    const siteData = await api.getSite({ siteId })

    // Get current environment variables set in the UI
    const {
      build_settings: { env = {} },
    } = siteData

    // Import environment variables from specified .env file
    const { fileName } = args
    let importedEnv = {}
    try {
      const envFileContents = fs.readFileSync(fileName)
      importedEnv = dotenv.parse(envFileContents)
    } catch (error) {
      this.log(error.message)
      this.exit(1)
    }

    if (isEmpty(importedEnv)) {
      this.log(`No environment variables found in file ${fileName} to import`)
      return false
    }

    // Apply environment variable updates
    const siteResult = await api.updateSite({
      siteId,
      body: {
        build_settings: {
          // Only set imported variables if --replaceExisting or otherwise merge
          // imported ones with the current environment variables.
          env: flags.replaceExisting ? importedEnv : { ...env, ...importedEnv },
        },
      },
    })

    // Return new environment variables of site if using json flag
    if (flags.json) {
      this.logJson(siteResult.build_settings.env)
      return false
    }

    // List newly imported environment variables in a table
    this.log(`site: ${siteData.name}`)
    const table = new AsciiTable(`Imported environment variables`)

    table.setHeading('Key', 'Value')
    for (const [key, value] of Object.entries(importedEnv)) {
      table.addRow(key, value)
    }
    this.log(table.toString())
  }
}

EnvImportCommand.description = `Import and set environment variables from .env file`
EnvImportCommand.flags = {
  replaceExisting: flagsLib.boolean({
    char: 'r',
    description: 'Replace all existing variables instead of merging them with the current ones',
    default: false,
  }),
  ...EnvImportCommand.flags,
}
EnvImportCommand.args = [
  {
    name: 'fileName',
    required: true,
    description: '.env file to import',
  },
]

module.exports = EnvImportCommand
