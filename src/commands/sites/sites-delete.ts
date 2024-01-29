import { OptionValues } from 'commander'

import { chalk } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { NetlifyLog, confirm, intro, outro } from '../../utils/styles/index.js'

const deleteSite = async (siteId: string, command: BaseCommand) => {
  const { api } = command.netlify

  NetlifyLog.message(`Deleting site "${siteId}"...`)

  try {
    await api.deleteSite({ site_id: siteId })
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    if (error.status === 404) {
      NetlifyLog.error(`No site with id ${siteId} found. Please verify the siteId & try again.`)
      outro({ exit: true, message: 'Error deleting site' })
    } else {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      NetlifyLog.error(`Delete Site error: ${error_.status}: ${error_.message}`)
      outro({ exit: true, message: 'Error deleting site' })
    }
  }
}

export const sitesDelete = async (siteId: string, options: OptionValues, command: BaseCommand) => {
  !options.isChildCommand && intro('sites:delete')
  command.setAnalyticsPayload({ force: options.force })

  const { api, site } = command.netlify
  const cwdSiteId = site.id

  // 1. Prompt user for verification
  await command.authenticate(options.auth)

  let siteData
  try {
    siteData = await api.getSite({ siteId })
  } catch (error_) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    if (error_.status === 404) {
      NetlifyLog.error(`No site with id ${siteId} found. Please verify the siteId & try again.`)
      outro({ exit: true, message: 'Error deleting site' })
    }
  }

  if (!siteData) {
    NetlifyLog.error(`Unable to process site`)
    outro({ exit: true, message: 'Error deleting site' })
  }

  const noForce = options.force !== true

  /* Verify the user wants to delete the site */
  if (noForce) {
    NetlifyLog.warn(`You are about to permanently delete "${chalk.bold(siteData.name)}"`)
    NetlifyLog.message(`Verify this siteId "${siteId}" supplied is correct and proceed.`)
    NetlifyLog.info('To skip this prompt, pass a --force flag to the delete command')
    NetlifyLog.warn(`${chalk.bold('Be careful here. There is no undo!')}`)

    const wantsToDelete = await confirm({
      message: `WARNING: Are you sure you want to delete the "${siteData.name}" site?`,
      initialValue: false,
    })

    if (wantsToDelete) {
      await deleteSite(siteId, command)
      !options.isChildCommand && outro({ exit: true, message: `Site "${siteId}" successfully deleted!` })
    }

    outro({ exit: true, message: 'Site not deleted' })
  }

  /* Validation logic if siteId passed in does not match current site ID */
  if (noForce && cwdSiteId && cwdSiteId !== siteId) {
    NetlifyLog.warn('The siteId supplied does not match the current working directory siteId')
    NetlifyLog.info(`Supplied:       "${siteId}"`)
    NetlifyLog.info(`Current Site:   "${cwdSiteId}"`)
    NetlifyLog.message(`Verify this siteId "${siteId}" supplied is correct and proceed.`)
    NetlifyLog.info('To skip this prompt, pass a --force flag to the delete command')

    const wantsToDelete = await confirm({
      message: `Verify & Proceed with deletion of site "${siteId}"?`,
      initialValue: false,
    })

    if (wantsToDelete) {
      await deleteSite(siteId, command)
      !options.isChildCommand && outro({ exit: true, message: `Site "${siteId}" successfully deleted!` })
    }

    !options.isChildCommand && outro({ exit: true, message: 'Site not deleted' })
  }
}
