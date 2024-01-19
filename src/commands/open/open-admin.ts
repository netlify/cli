import { OptionValues } from 'commander'

import openBrowser from '../../utils/open-browser.js'
import { NetlifyLog, outro } from '../../utils/styles/index.js'
import BaseCommand from '../base-command.js'

export const openAdmin = async (options: OptionValues, command: BaseCommand) => {
  const { siteInfo } = command.netlify

  await command.authenticate()

  NetlifyLog.info(`Opening "${siteInfo.name}" site admin UI:`)
  NetlifyLog.info(`> ${siteInfo.admin_url}`)

  await openBrowser({ url: siteInfo.admin_url })
  outro({ exit: true })
}
