import { OptionValues } from 'commander'

import { log } from '../../utils/command-helpers.mjs'
import BaseCommand from '../base-command.mjs'

import { openAdmin } from './open-admin.mjs'
import { openSite } from './open-site.mjs'

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
