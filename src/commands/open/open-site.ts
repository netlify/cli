import { OptionValues } from 'commander'

import openBrowser from '../../utils/open-browser.js'
import { NetlifyLog, outro } from '../../utils/styles/index.js'
import BaseCommand from '../base-command.js'

export const openSite = async (options: OptionValues, command: BaseCommand) => {
  const { siteInfo } = command.netlify

  await command.authenticate()

  const url = siteInfo.ssl_url || siteInfo.url
  NetlifyLog.info(`Opening "${siteInfo.name}" site url:`)
  NetlifyLog.info(`> ${url}`)

  await openBrowser({ url })
  outro({ exit: true })
}
