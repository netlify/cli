import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import isEmpty from 'lodash/isEmpty.js'

import { listSites } from '../../lib/api.js'
import { chalk, error, exit, log } from '../../utils/command-helpers.js'
import getRepoData from '../../utils/get-repo-data.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { track } from '../../utils/telemetry/index.js'
import type { SiteInfo } from '../../utils/types.js'
import BaseCommand from '../base-command.js'

/**
 *
 * @param {import('../base-command.js').default} command
 * @param {import('commander').OptionValues} options
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const linkPrompt = async (command, options) => {
  const { api, state } = command.netlify

  const SITE_NAME_PROMPT = 'Search by full or partial site name'
  const SITE_LIST_PROMPT = 'Choose from a list of your recently updated sites'
  const SITE_ID_PROMPT = 'Enter a site ID'

  let GIT_REMOTE_PROMPT = 'Use the current git remote origin URL'
  let site
  // Get git remote data if exists
  const repoData = await getRepoData({ workingDir: command.workingDir, remoteName: options.gitRemoteName })

  let linkChoices = [SITE_NAME_PROMPT, SITE_LIST_PROMPT, SITE_ID_PROMPT]

  if (!repoData.error) {
    // Add git GIT_REMOTE_PROMPT if in a repo
    GIT_REMOTE_PROMPT = `Use current git remote origin (${repoData.httpsUrl})`
    linkChoices = [GIT_REMOTE_PROMPT, ...linkChoices]
  }

  log()
  log(`${chalk.cyanBright('netlify link')} will connect this folder to a site on Netlify`)
  log()
  const { linkType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'linkType',
      message: 'How do you want to link this folder to a site?',
      choices: linkChoices,
    },
  ])

  let kind
  switch (linkType) {
    case GIT_REMOTE_PROMPT: {
      kind = 'gitRemote'
      log()
      log(`Looking for sites connected to '${repoData.httpsUrl}'...`)
      log()
      const sites = await listSites({ api, options: { filter: 'all' } })

      if (sites.length === 0) {
        error(`You don't have any sites yet. Run ${chalk.cyanBright('netlify sites:create')} to create a site.`)
      }

      const matchingSites = sites.filter(
        ({ build_settings: buildSettings = {} }) => repoData.httpsUrl === buildSettings.repo_url,
      )

      // If no remote matches. Throw error
      if (matchingSites.length === 0) {
        log(chalk.redBright.bold.underline(`No Matching Site Found`))
        log()
        log(`No site found with the remote ${repoData.httpsUrl}.

Double check you are in the correct working directory and a remote origin repo is configured.

Run ${chalk.cyanBright('git remote -v')} to see a list of your git remotes.`)

        exit()
      }

      // Matches a single site hooray!
      if (matchingSites.length === 1) {
        const [firstSite] = matchingSites
        site = firstSite
      } else if (matchingSites.length > 1) {
        // Matches multiple sites. Users must choose which to link.
        log(`Found ${matchingSites.length} matching sites!`)

        // Prompt which options
        const { selectedSite } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedSite',
            message: 'Which site do you want to link?',
            choices: matchingSites.map((matchingSite) => ({
              name: `${matchingSite.name} - ${matchingSite.ssl_url}`,
              value: matchingSite,
            })),
          },
        ])
        if (!selectedSite) {
          error('No site selected')
        }
        site = selectedSite
      }
      break
    }
    case SITE_NAME_PROMPT: {
      kind = 'byName'
      const { searchTerm } = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchTerm',
          message: 'Enter the site name (or just part of it):',
        },
      ])
      log(`Looking for sites with names containing '${searchTerm}'...`)
      log()

      let matchingSites: SiteInfo[] = []
      try {
        matchingSites = await listSites({
          api,
          options: { name: searchTerm, filter: 'all' },
        })
      } catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error_.status === 404) {
          error(`'${searchTerm}' not found`)
        } else {
          // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
          error(error_)
        }
      }

      if (!matchingSites || matchingSites.length === 0) {
        error(`No site names found containing '${searchTerm}'.

Run ${chalk.cyanBright('netlify link')} again to try a new search,
or run ${chalk.cyanBright('netlify sites:create')} to create a site.`)
      }

      if (matchingSites.length > 1) {
        log(`Found ${matchingSites.length} matching sites!`)
        const { selectedSite } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedSite',
            message: 'Which site do you want to link?',
            paginated: true,
            choices: matchingSites.map((matchingSite) => ({ name: matchingSite.name, value: matchingSite })),
          },
        ])
        if (!selectedSite) {
          error('No site selected')
        }
        site = selectedSite
      } else {
        const [firstSite] = matchingSites
        site = firstSite
      }
      break
    }
    case SITE_LIST_PROMPT: {
      kind = 'fromList'
      log(`Fetching recently updated sites...`)
      log()

      let sites
      try {
        sites = await listSites({ api, options: { maxPages: 1, filter: 'all' } })
      } catch (error_) {
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        error(error_)
      }

      if (!sites || sites.length === 0) {
        error(`You don't have any sites yet. Run ${chalk.cyanBright('netlify sites:create')} to create a site.`)
      }

      const { selectedSite } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSite',
          message: 'Which site do you want to link?',
          paginated: true,
          // @ts-expect-error TS(7006) FIXME: Parameter 'matchingSite' implicitly has an 'any' t... Remove this comment to see the full error message
          choices: sites.map((matchingSite) => ({ name: matchingSite.name, value: matchingSite })),
        },
      ])
      if (!selectedSite) {
        error('No site selected')
      }
      site = selectedSite
      break
    }
    case SITE_ID_PROMPT: {
      kind = 'bySiteId'
      const { siteId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'siteId',
          message: 'What is the site ID?',
        },
      ])

      try {
        site = await api.getSite({ siteId })
      } catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error_.status === 404) {
          error(new Error(`Site ID '${siteId}' not found`))
        } else {
          // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
          error(error_)
        }
      }
      break
    }
    default:
      return
  }

  if (!site) {
    error(new Error(`No site found`))
  }

  // Save site ID to config
  state.set('siteId', site.id)

  await track('sites_linked', {
    siteId: site.id,
    linkType: 'prompt',
    kind,
  })

  // Log output
  log()
  log(chalk.greenBright.bold.underline(`Directory Linked`))
  log()
  log(`Admin url: ${chalk.magentaBright(site.admin_url)}`)
  log(`Site url:  ${chalk.cyanBright(site.ssl_url || site.url)}`)
  log()
  log(`You can now run other \`netlify\` cli commands in this directory`)

  return site
}

export const link = async (options: OptionValues, command: BaseCommand) => {
  await command.authenticate()

  const {
    api,
    repositoryRoot,
    site: { id: siteId },
    siteInfo,
    state,
  } = command.netlify

  let siteData = siteInfo

  // Add .netlify to .gitignore file
  await ensureNetlifyIgnore(repositoryRoot)

  // Site id is incorrect
  if (siteId && isEmpty(siteData)) {
    log(`"${siteId}" was not found in your Netlify account.`)
    log(`Please double check your siteID and which account you are logged into via \`netlify status\`.`)
    return exit()
  }

  if (!isEmpty(siteInfo)) {
    // If already linked to site. exit and prompt for unlink
    log(`Site already linked to "${siteData.name}"`)
    log(`Admin url: ${siteData.admin_url}`)
    log()
    log(`To unlink this site, run: ${chalk.cyanBright('netlify unlink')}`)
  } else if (options.id) {
    try {
      siteData = await api.getSite({ site_id: options.id })
    } catch (error_) {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      if (error_.status === 404) {
        error(new Error(`Site id ${options.id} not found`))
      } else {
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        error(error_)
      }
    }

    // Save site ID
    state.set('siteId', siteData.id)
    log(`Linked to ${siteData.name}`)

    await track('sites_linked', {
      siteId: siteData.id,
      linkType: 'manual',
      kind: 'byId',
    })
  } else if (options.name) {
    let results: SiteInfo[] = []
    try {
      results = await listSites({
        api,
        options: {
          name: options.name,
          filter: 'all',
        },
      })
    } catch (error_) {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      if (error_.status === 404) {
        error(new Error(`${options.name} not found`))
      } else {
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        error(error_)
      }
    }

    if (results.length === 0) {
      error(new Error(`No sites found named ${options.name}`))
    }

    const matchingSiteData = results.find((site: SiteInfo) => site.name === options.name) || results[0]
    state.set('siteId', matchingSiteData.id)

    log(`Linked to ${matchingSiteData.name}`)

    await track('sites_linked', {
      siteId: (matchingSiteData && matchingSiteData.id) || siteId,
      linkType: 'manual',
      kind: 'byName',
    })
  } else {
    siteData = await linkPrompt(command, options)
  }
  return siteData
}
