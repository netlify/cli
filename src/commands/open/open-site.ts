import type { OptionValues } from 'commander'

import { exit, log } from '../../utils/command-helpers.js'
import openBrowser from '../../utils/open-browser.js'
import type BaseCommand from '../base-command.js'

export const openSite = async (_options: OptionValues, command: BaseCommand) => {
  const { siteInfo } = command.netlify

  await command.authenticate()

  const url = siteInfo.ssl_url || siteInfo.url
  log(`Opening "${siteInfo.name}" project url:`)
  log(`> ${url}`)

  await openBrowser({ url })
  exit()
}
