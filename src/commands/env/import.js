const AsciiTable = require('ascii-table')
const Command = require('../../utils/command')
const dotenv = require('dotenv')
const fs = require('fs')
const isEmpty = require('lodash.isempty')

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

    const newEnv = env

    // Import environment variables from specified .env file
    const { fileName } = args
    let importedEnv = {}
    try {
      const envFileContents = fs.readFileSync(fileName)
      importedEnv = dotenv.parse(envFileContents)
    } catch (e) {
      this.error(e)
    }

    if (isEmpty(importedEnv)) {
      this.log(`No environment variables found in file ${fileName} to import`)
      return false
    }

    // Merge imported variables with the existing ones
    for (const [key, value] of Object.entries(importedEnv)) {
      if (!value.trim()) {
        delete newEnv[key] // delete variable if value is unset
      } else {
        newEnv[key] = value
      }
    }

    // Apply environment variable updates
    const siteResult = await api.updateSite({
      siteId,
      body: {
        build_settings: {
          env: newEnv,
        },
      },
    })

    // Return updated site object if using json flag
    if (flags.json) {
      this.logJson(siteResult)
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
EnvImportCommand.args = [
  {
    name: 'fileName',
    required: true,
    description: '.env file to import',
  },
]

module.exports = EnvImportCommand
