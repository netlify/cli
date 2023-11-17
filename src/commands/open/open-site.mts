import { OptionValues } from 'commander'

import { exit, log } from '../../utils/command-helpers.mjs'
import openBrowser from '../../utils/open-browser.mjs'
import BaseCommand from '../base-command.mjs'

export const openSite = async (options: OptionValues, command: BaseCommand) => {
  const { siteInfo } = command.netlify

  await command.authenticate()

  const url = siteInfo.ssl_url || siteInfo.url
  log(`Opening "${siteInfo.name}" site url:`)
  log(`> ${url}`)

  // @ts-expect-error TS(2345) FIXME: Argument of type '{ url: any; }' is not assignable... Remove this comment to see the full error message
  await openBrowser({ url })
  exit()
}
