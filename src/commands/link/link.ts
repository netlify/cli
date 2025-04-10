import assert from 'node:assert'

import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import isEmpty from 'lodash/isEmpty.js'

import { listSites } from '../../lib/api.js'
import { chalk, logAndThrowError, exit, log, APIError } from '../../utils/command-helpers.js'
import getRepoData from '../../utils/get-repo-data.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { track } from '../../utils/telemetry/index.js'
import type { SiteInfo } from '../../utils/types.js'
import BaseCommand from '../base-command.js'

const linkPrompt = async (command: BaseCommand, options: OptionValues): Promise<SiteInfo> => {
  const { api, state } = command.netlify

  const SITE_NAME_PROMPT = 'Search by full or partial site name'
  const SITE_LIST_PROMPT = 'Choose from a list of your recently updated sites'
  const SITE_ID_PROMPT = 'Enter a site ID'

  let GIT_REMOTE_PROMPT = 'Use the current git remote origin URL'
  let site!: SiteInfo
  // Get git remote data if exists
  const repoData = await getRepoData({ workingDir: command.workingDir, remoteName: options.gitRemoteName })

  let linkChoices = [SITE_NAME_PROMPT, SITE_LIST_PROMPT, SITE_ID_PROMPT]

  if (!('error' in repoData)) {
    // Add git GIT_REMOTE_PROMPT if in a repo
    GIT_REMOTE_PROMPT = `Use current git remote origin (${repoData.httpsUrl})`
    linkChoices = [GIT_REMOTE_PROMPT, ...linkChoices]
  }

  log()
  log(`${chalk.cyanBright('netlify link')} will connect this folder to a site on Netlify`)
  log()
  const { linkType } = (await inquirer.prompt([
    {
      type: 'list',
      name: 'linkType',
      message: 'How do you want to link this folder to a site?',
      choices: linkChoices,
    },
  ])) as { linkType: typeof linkChoices[number] }

  let kind: 'byName' | 'bySiteId' | 'fromList' | 'gitRemote'
  switch (linkType) {
    case GIT_REMOTE_PROMPT: {
      // TODO(serhalp): Refactor function to avoid this. We can only be here if `repoData` is not an error.
      assert(!('error' in repoData))

      kind = 'gitRemote'
      log()
      log(`Looking for sites connected to '${repoData.httpsUrl}'...`)
      log()
      const sites = await listSites({ api, options: { filter: 'all' } })

      if (sites.length === 0) {
        return logAndThrowError(
          `You don't have any sites yet. Run ${chalk.cyanBright('netlify sites:create')} to create a site.`,
        )
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
        const { selectedSite } = (await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedSite',
            message: 'Which site do you want to link?',
            choices: matchingSites.map((matchingSite) => ({
              name: `${matchingSite.name} - ${matchingSite.ssl_url}`,
              value: matchingSite,
            })),
          },
        ])) as { selectedSite: SiteInfo | undefined }
        if (!selectedSite) {
          return logAndThrowError('No site selected')
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
        if ((error_ as APIError).status === 404) {
          return logAndThrowError(`'${searchTerm}' not found`)
        } else {
          return logAndThrowError(error_)
        }
      }

      if (!matchingSites || matchingSites.length === 0) {
        return logAndThrowError(`No site names found containing '${searchTerm}'.

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
          return logAndThrowError('No site selected')
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

      let sites: SiteInfo[]
      try {
        sites = await listSites({ api, options: { maxPages: 1, filter: 'all' } })
      } catch (error_) {
        return logAndThrowError(error_)
      }

      if (!sites || sites.length === 0) {
        return logAndThrowError(
          `You don't have any sites yet. Run ${chalk.cyanBright('netlify sites:create')} to create a site.`,
        )
      }

      const { selectedSite } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSite',
          message: 'Which site do you want to link?',
          paginated: true,
          choices: sites.map((matchingSite) => ({ name: matchingSite.name, value: matchingSite })),
        },
      ])
      if (!selectedSite) {
        return logAndThrowError('No site selected')
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
        // @ts-expect-error(serhalp) -- Mismatch between hardcoded `SiteInfo` and generated Netlify API types.
        site = await api.getSite({ siteId })
      } catch (error_) {
        if ((error_ as APIError).status === 404) {
          return logAndThrowError(`Site ID '${siteId}' not found`)
        } else {
          return logAndThrowError(error_)
        }
      }
      break
    }
    default:
      // This is not possible, but since the fixed set of choices contains one dynamically interpolated string,
      // we can't tell TS that these are exhaustive values
      return logAndThrowError(new Error('Invalid link type selected'))
  }

  if (!site) {
    return logAndThrowError(new Error(`No site found`))
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

  let initialSiteData: SiteInfo | undefined
  let newSiteData!: SiteInfo

  // Add .netlify to .gitignore file
  await ensureNetlifyIgnore(repositoryRoot)

  // Site id is incorrect
  if (siteId && isEmpty(siteInfo)) {
    log(`"${siteId}" was not found in your Netlify account.`)
    log(`Please double check your siteID and which account you are logged into via \`netlify status\`.`)
    return exit()
  }

  if (!isEmpty(siteInfo)) {
    // If already linked to site, exit and prompt for unlink
    initialSiteData = siteInfo
    log(`Site already linked to "${initialSiteData.name}"`)
    log(`Admin url: ${initialSiteData.admin_url}`)
    log()
    log(`To unlink this site, run: ${chalk.cyanBright('netlify unlink')}`)
  } else if (options.id) {
    try {
      // @ts-expect-error(serhalp) -- Mismatch between hardcoded `SiteInfo` and new generated Netlify API types.
      newSiteData = await api.getSite({ site_id: options.id })
    } catch (error_) {
      if ((error_ as APIError).status === 404) {
        return logAndThrowError(new Error(`Site id ${options.id} not found`))
      } else {
        return logAndThrowError(error_)
      }
    }

    // Save site ID
    state.set('siteId', newSiteData.id)
    log(`Linked to ${newSiteData.name}`)

    await track('sites_linked', {
      siteId: newSiteData.id,
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
      if ((error_ as APIError).status === 404) {
        return logAndThrowError(new Error(`${options.name} not found`))
      } else {
        return logAndThrowError(error_)
      }
    }

    if (results.length === 0) {
      return logAndThrowError(new Error(`No sites found named ${options.name}`))
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
    newSiteData = await linkPrompt(command, options)
  }
  // FIXME(serhalp): All the cases above except one (look up by site name) end up *returning*
  // the site data. This is probably not intentional and may result in bugs in deploy/init. Investigate.
  return initialSiteData || newSiteData
}
