const isEmpty = require('lodash/isEmpty')

const Command = require('../../utils/command')
const { exit, log, logJson } = require('../../utils/command-helpers')

class EnvTransferCommand extends Command {
  async run() {
    const { args, flags } = this.parse(EnvTransferCommand)
    const { api, site } = this.netlify
    const { siteA, siteB } = args

    const siteId = {
      from: site.id || siteA,
      to: site.id ? siteA : siteB,
    }

    if (!siteId.to) {
      log(
        'Please include the site destination (siteB) as second argument, or try to run this command again inside a site folder',
      )
      exit(1)
    }

    const [siteFrom, siteTo] = await Promise.all([
      api.getSite({ siteId: siteId.from }),
      api.getSite({ siteId: siteId.to }),
    ])

    const [
      {
        build_settings: { env: envFrom = {} },
      },
      {
        build_settings: { env: envTo = {} },
      },
    ] = [siteFrom, siteTo]

    if (isEmpty(envFrom)) {
      log(`${siteFrom.name} has no env variable, nothing to transfer`)
      return false
    }
    // Apply environment variable updates
    const siteResult = await api.updateSite({
      siteId: siteId.to,
      body: {
        build_settings: {
          // Merge from site A to site B
          env: {
            ...envTo,
            ...envFrom,
          },
        },
      },
    })

    if (flags.json) {
      logJson(siteResult.build_settings.env)
      return false
    }

    log(`Success transfer env variable from "${siteFrom.name}" => "${siteTo.name}"`)
  }
}

EnvTransferCommand.description = `Transfer env from one site to another`

EnvTransferCommand.args = [
  {
    name: 'siteA',
    required: true,
    description: '(From) site Id, if second argument is omitted, this argument will be the destination (To)',
  },
  {
    name: 'siteB',
    required: false,
    default: '',
    description: '(To) site Id',
  },
]

module.exports = EnvTransferCommand
