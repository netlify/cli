import type { Command } from 'commander'

import { logAndThrowError, warn, type APIError } from '../command-helpers.js'
import type BaseCommand from '../../commands/base-command.js'

/**
 * A preAction hook that errors out if siteInfo is an empty object
 * Also handles --project flag to resolve site by name
 */
const requiresSiteInfoWithProject = async (command: Command) => {
  // commander (at least the version we're on) is typed such that `.preAction()` can't accept
  // a subclass of `Command`. This type assertion avoids a lot of type noise in every call site.
  const baseCommand = command as BaseCommand
  const { api, site } = baseCommand.netlify
  const options = baseCommand.opts<{ project?: string }>()

  let siteId = site.id

  // If --project flag is provided, resolve it to a site ID
  if (options.project && !siteId) {
    try {
      // Try to get site by ID first (if project looks like an ID)
      if (options.project.length === 24 && /^[a-f0-9]+$/i.test(options.project)) {
        const siteData = await api.getSite({ siteId: options.project })
        if (siteData.id) {
          siteId = siteData.id
          // Update the site info in the command
          baseCommand.netlify.site.id = siteId
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          baseCommand.netlify.siteInfo = siteData as any // Type assertion needed due to API type mismatch
        }
      } else {
        const sites = await api.listSites({
          filter: 'all',
          name: options.project,
        })
        const matchedSite = sites.find((site) => site.name === options.project)

        if (matchedSite?.id) {
          siteId = matchedSite.id
          // Update the site info in the command
          baseCommand.netlify.site.id = siteId
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          baseCommand.netlify.siteInfo = matchedSite as any // Type assertion needed due to API type mismatch
        } else {
          return logAndThrowError(`Project "${options.project}" not found. Make sure you have access to this project.`)
        }
      }
    } catch (error_) {
      const error = error_ as APIError
      if (error.status === 401) {
        return logAndThrowError(`Not authorized to access project "${options.project}"`)
      }
      if (error.status === 404) {
        return logAndThrowError(`Project "${options.project}" not found`)
      }
      return logAndThrowError(`Failed to resolve project "${options.project}": ${error.message}`)
    }
  }

  // Now check if we have a site ID (either from link or --project)
  if (!siteId) {
    warn('Did you run `netlify link` yet?')
    return logAndThrowError(
      `You don't appear to be in a folder that is linked to a project. Use --project <project-id-or-slug> to specify a project.`,
    )
  }

  // Verify site access
  try {
    const siteData = await api.getSite({ siteId })
    // Update siteInfo if we haven't already
    if (!baseCommand.netlify.siteInfo.id) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      baseCommand.netlify.siteInfo = siteData as any // Type assertion needed due to API type mismatch
    }
  } catch (error_) {
    // unauthorized
    if ((error_ as APIError).status === 401) {
      warn(`Log in with a different account or re-link to a project you have permission for`)
      return logAndThrowError(`Not authorized to view the project (${siteId})`)
    }
    // missing
    if ((error_ as APIError).status === 404) {
      return logAndThrowError(`The project can't be found`)
    }

    return logAndThrowError(error_)
  }
}

export default requiresSiteInfoWithProject
