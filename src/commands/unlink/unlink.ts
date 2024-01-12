import { OptionValues } from 'commander'

import { NetlifyLog, intro, outro } from '../../utils/styles/index.js'
import { track } from '../../utils/telemetry/index.js'
import BaseCommand from '../base-command.js'

export const unlink = async (options: OptionValues, command: BaseCommand) => {
  intro('unlink')
  const { site, siteInfo, state } = command.netlify
  const siteId = site.id

  if (!siteId) {
    NetlifyLog.error(`Folder is not linked to a Netlify site. Run 'netlify link' to link it`)
  }

  const siteData = siteInfo

  state.delete('siteId')

  await track('sites_unlinked', {
    siteId: siteData.id || siteId,
  })

  if (site) {
    NetlifyLog.success(`Unlinked from ${siteData ? siteData.name : siteId}`)
  } else {
    NetlifyLog.success('Unlinked site')
  }
  outro({ exit: true })
}
