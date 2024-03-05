import { OptionValues } from 'commander'

import { log } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

import { openAdmin } from './open-admin.js'
import { openSite } from './open-site.js'

export const open = async (options: OptionValues, command: BaseCommand) => {
  if (!options.site || !options.admin) {
    log(command.helpInformation())
  }

  if (options.site) {
    await openSite(options, command)
  }
  // Default open netlify admin
  await openAdmin(options, command)
}
