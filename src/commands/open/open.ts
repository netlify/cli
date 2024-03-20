import { OptionValues } from 'commander'

import { NetlifyLog, intro } from '../../utils/styles/index.js'
import BaseCommand from '../base-command.js'

import { openAdmin } from './open-admin.js'
import { openSite } from './open-site.js'

export const open = async (options: OptionValues, command: BaseCommand) => {
  intro('open')
  if (!options.site || !options.admin) {
    NetlifyLog.info(command.helpInformation())
  }

  if (options.site) {
    await openSite(options, command)
  }
  // Default open netlify admin
  await openAdmin(options, command)
}
