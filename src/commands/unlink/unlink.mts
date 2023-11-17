import { OptionValues } from 'commander'

import { exit, log } from '../../utils/command-helpers.mjs'
import { track } from '../../utils/telemetry/index.mjs'
import BaseCommand from '../base-command.mjs'


export const unlink = async (options: OptionValues, command: BaseCommand) => {
  const { site, siteInfo, state } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log(`Folder is not linked to a Netlify site. Run 'netlify link' to link it`)
    return exit()
  }

  const siteData = siteInfo

  state.delete('siteId')

  await track('sites_unlinked', {
    siteId: siteData.id || siteId,
  })

  if (site) {
    log(`Unlinked ${site.configPath} from ${siteData ? siteData.name : siteId}`)
  } else {
    log('Unlinked site')
  }
}
