import { OptionValues } from 'commander'

import { ADDON_VALIDATION, prepareAddonCommand } from '../../utils/addons/prepare.js'
import { exit, log } from '../../utils/command-helpers.js'
import openBrowser from '../../utils/open-browser.js'
import BaseCommand from '../base-command.js'

export const addonsAuth = async (addonName: string, options: OptionValues, command: BaseCommand) => {
  const { addon } = await prepareAddonCommand({
    command,
    addonName,
    validation: ADDON_VALIDATION.EXISTS,
  })

  if (!addon.auth_url) {
    log(`No Admin URL found for the "${addonName} add-on"`)
    return false
  }

  log()
  log(`Opening ${addonName} add-on admin URL:`)
  log()
  log(addon.auth_url)
  log()
  // @ts-expect-error TS(2345) FIXME: Argument of type '{ url: any; }' is not assignable... Remove this comment to see the full error message
  await openBrowser({ url: addon.auth_url })
  exit()
}
