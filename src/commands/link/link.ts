import { OptionValues } from 'commander'
import isEmpty from 'lodash/isEmpty.js'

import { listSites } from '../../lib/api.js'
import { chalk } from '../../utils/command-helpers.js'
import getRepoData from '../../utils/get-repo-data.js'
import { ensureNetlifyIgnore } from '../../utils/gitignore.js'
import { NetlifyLog, intro, outro, select, spinner, text } from '../../utils/styles/index.js'
import { track } from '../../utils/telemetry/index.js'
import BaseCommand from '../base-command.js'

const linkPrompt = async (command: BaseCommand, options: OptionValues) => {
  const { api, state } = command.netlify

  const SITE_NAME_PROMPT = 'Search by full or partial site name'
  const SITE_LIST_PROMPT = 'Choose from a list of your recently updated sites'
  const SITE_ID_PROMPT = 'Enter a site ID'
  let GIT_REMOTE_PROMPT = 'Use the current git remote origin URL'
  let site
  // Get git remote data if exists
  const repoData = await getRepoData({ workingDir: command.workingDir, remoteName: options.gitRemoteName })

  let linkOptions = [{ value: SITE_NAME_PROMPT }, { value: SITE_LIST_PROMPT }, { value: SITE_ID_PROMPT }]

  if (!repoData.error) {
    // Add git GIT_REMOTE_PROMPT if in a repo
    GIT_REMOTE_PROMPT = `Use current git remote origin (${repoData.httpsUrl})`
    linkOptions = [{ value: GIT_REMOTE_PROMPT }, ...linkOptions]
  }

  NetlifyLog.message(`${chalk.cyanBright('netlify link')} will connect this folder to a site on Netlify`)

  const linkType = await select({
    message: 'How do you want to link this folder to a site?',
    options: linkOptions,
  })

  let kind
  switch (linkType) {
    case GIT_REMOTE_PROMPT: {
      kind = 'gitRemote'
      const loading = spinner()
      loading.start(`Looking for sites connected to '${repoData.httpsUrl}' (this can take a bit).`)
      const sites = await listSites({ api, options: { filter: 'all' } })
      if (sites.length === 0) {
        loading.stop(
          `You don't have any sites yet. Run ${chalk.cyanBright('netlify sites:create')} to create a site.`,
          1,
        )
        outro({ exit: true })
      }

      const matchingSites = sites.filter(
        ({ build_settings: buildSettings = {} }: { build_settings: { repo_url?: string } }) =>
          repoData.httpsUrl === buildSettings.repo_url,
      )

      // If no remote matches. Throw error
      if (matchingSites.length === 0) {
        NetlifyLog.warn(chalk.bold(`No matching Site Found`))

        NetlifyLog.message(`We couldn't find a site with the remote ${repoData.httpsUrl}.

            Double check you are in the correct working directory and a remote origin repository is configured.

            Run ${chalk.cyanBright('git remote -v')} to see a list of your git remotes.`)

        outro({ exit: true })
      }

      // Matches a single site hooray!
      if (matchingSites.length === 1) {
        loading.stop('Found a matching site!')
        const [firstSite] = matchingSites
        site = firstSite
      } else if (matchingSites.length > 1) {
        // Matches multiple sites. Users must choose which to link.
        loading.stop(`Found ${matchingSites.length} matching sites!`)

        // Prompt which options
        const selectedSite = await select({
          message: 'Which site do you want to link?',
          options: matchingSites.map((matchingSite: { name: string; ssl_url: string }) => ({
            label: `${matchingSite.name} - ${matchingSite.ssl_url}`,
            value: matchingSite,
          })),
        })

        if (!selectedSite) {
          NetlifyLog.error('No site selected')
        }
        site = selectedSite
      }
      break
    }
    case SITE_NAME_PROMPT: {
      kind = 'byName'
      const searchTerm = await text({
        message: 'Enter the site name (or just part of it):',
        validate: (value) => {
          if (!value) return 'Please enter a site name'
        },
      })
      const loading = spinner()
      loading.start(`Looking for sites with names containing '${searchTerm}'`)

      let matchingSites
      try {
        matchingSites = await listSites({
          api,
          options: { name: searchTerm, filter: 'all' },
        })
      } catch (error: unknown) {
        if ((error as { status: number }).status === 404) {
          NetlifyLog.error(`'${searchTerm}' not found`)
        } else {
          NetlifyLog.error(error)
        }
      }

      if (!matchingSites || matchingSites.length === 0) {
        loading.stop(`No site names found containing '${searchTerm}'.`, 1)
        outro({
          message: `Run ${chalk.cyanBright('netlify link')} again to try a new search, or run ${chalk.cyanBright(
            'netlify sites:create',
          )} to create a site.`,
          exit: true,
        })
      }

      if (matchingSites.length > 1) {
        loading.stop(`Found ${matchingSites.length} matching sites!`)

        const selectedSite = await select({
          message: 'Which site do you want to link?',
          options: matchingSites.map((matchingSite: { name: string; ssl_url: string }) => ({
            label: matchingSite.name,
            value: matchingSite,
          })),
        })

        if (!selectedSite) {
          NetlifyLog.error('No site selected')
        }
        site = selectedSite
      } else {
        loading.stop('Found a matching site!')
        const [firstSite] = matchingSites
        site = firstSite
      }
      break
    }
    case SITE_LIST_PROMPT: {
      kind = 'fromList'
      const loading = spinner()
      loading.start(`Fetching recently updated sites...`)

      let sites
      try {
        sites = await listSites({ api, options: { maxPages: 1, filter: 'all' } })
      } catch (error_) {
        NetlifyLog.error(error_)
      }

      if (!sites || sites.length === 0) {
        NetlifyLog.error(
          `You don't have any sites yet. Run ${chalk.cyanBright('netlify sites:create')} to create a site.`,
        )
      }

      loading.stop(`Found ${sites.length} sites!`)
      const selectedSite = await select({
        message: 'Which site do you want to link?',
        maxItems: 7,
        options: sites.map((matchingSite: { name: string; ssl_url: string }) => ({
          label: matchingSite.name,
          value: matchingSite,
        })),
      })

      if (!selectedSite) {
        NetlifyLog.error('No site selected')
      }
      site = selectedSite
      break
    }
    case SITE_ID_PROMPT: {
      kind = 'bySiteId'
      const siteId = await text({
        message: 'What is the site ID?',
        validate: (value) => {
          if (!value) return 'Please enter a site ID'
        },
      })

      try {
        site = await api.getSite({ siteId })
      } catch (error: unknown) {
        if ((error as { status: number }).status === 404) {
          NetlifyLog.error(new Error(`Site ID '${siteId}' not found`))
        } else {
          NetlifyLog.error(error)
        }
      }
      break
    }
    default:
      return
  }

  if (!site) {
    NetlifyLog.error(new Error(`No site found`))
  }

  // Save site ID to config
  state.set('siteId', site.id)

  await track('sites_linked', {
    siteId: site.id,
    linkType: 'prompt',
    kind,
  })

  // Log output
  NetlifyLog.success('Directory Linked')
  NetlifyLog.message(`Admin URL: ${chalk.magentaBright(site.admin_url)}`)
  NetlifyLog.message(`Site URL:  ${chalk.cyanBright(site.ssl_url || site.url)}`)

  if (options.isChildCommand) {
    NetlifyLog.info(`You can now run other \`netlify\` cli commands in this directory`)

    return site
  } else {
    outro({ message: `You can now run other \`netlify\` cli commands in this directory` })

    return site
  }
}

export const link = async (options: OptionValues, command: BaseCommand) => {
  await command.authenticate()
  !options.isChildCommand && intro('link')
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
    NetlifyLog.error(`"${siteId}" was not found in your Netlify account.`)
    outro({
      message: `Please double check your site ID and which account you are logged into via \`netlify status\`.`,
    })
  }

  if (!isEmpty(siteInfo)) {
    // If already linked to site. exit and prompt for unlink
    NetlifyLog.info(`Site already linked to "${siteData.name}"`)
    NetlifyLog.message(`Admin URL: ${siteData.admin_url}`)
    outro({ message: `To unlink this site, run: ${chalk.cyanBright('netlify unlink')}` })
  } else if (options.id) {
    try {
      siteData = await api.getSite({ site_id: options.id })
    } catch (error: unknown) {
      if ((error as { status: number }).status === 404) {
        NetlifyLog.error(new Error(`Site with ID ${options.id} has not been found`))
      } else {
        NetlifyLog.error(error)
      }
    }

    // Save site ID
    state.set('siteId', siteData.id)
    NetlifyLog.success(`Linked to ${siteData.name}`)
    NetlifyLog.message(`Admin URL: ${siteData.admin_url}`)
    outro({ message: `To unlink this site, run: ${chalk.cyanBright('netlify unlink')}` })

    await track('sites_linked', {
      siteId: siteData.id,
      linkType: 'manual',
      kind: 'byId',
    })
  } else if (options.name) {
    let results
    try {
      results = await listSites({
        api,
        options: {
          name: options.name,
          filter: 'all',
        },
      })
    } catch (error: unknown) {
      if ((error as { status: number }).status === 404) {
        NetlifyLog.error(new Error(`${options.name} not found`))
      } else {
        NetlifyLog.error(error)
      }
    }

    if (results.length === 0) {
      NetlifyLog.error(new Error(`No sites found named ${options.name}`))
    }
    const [firstSiteData] = results
    state.set('siteId', firstSiteData.id)
    NetlifyLog.success(`Linked to ${firstSiteData.name}`)
    NetlifyLog.message(`Admin URL: ${firstSiteData.admin_url}`)
    outro({ message: `To unlink this site, run: ${chalk.cyanBright('netlify unlink')}` })

    await track('sites_linked', {
      siteId: (firstSiteData && firstSiteData.id) || siteId,
      linkType: 'manual',
      kind: 'byName',
    })
  } else {
    siteData = await linkPrompt(command, options)
  }
  return siteData
}
