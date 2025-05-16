import { exit, log } from '../../utils/command-helpers.js'
import openBrowser from '../../utils/open-browser.js'
import type BaseCommand from '../base-command.js'

export const openAdmin = async (_options: unknown, command: BaseCommand) => {
  const { siteInfo } = command.netlify

  await command.authenticate()

  log(`Opening "${siteInfo.name}" project admin UI:`)
  log(`> ${siteInfo.admin_url}`)

  await openBrowser({ url: siteInfo.admin_url })
  exit()
}
