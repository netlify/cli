const inquirer = require('inquirer')
const chalk = require('chalk')
const getRepoData = require('../getRepoData')
const isEmpty = require('lodash.isempty')

module.exports = async function linkPrompts(context) {
  const { api, state } = context.netlify
  let site
  let GIT_REMOTE_PROMPT = `Use current git remote URL`
  const SITE_NAME_PROMPT = 'Site Name'
  const SITE_ID_PROMPT = 'Site ID'

  // Get git remote data if exists
  const repoInfo = await getRepoData()

  const LinkChoices = [
    SITE_NAME_PROMPT,
    SITE_ID_PROMPT
  ]

  let repoUrl = ''
  if (!repoInfo.error) {
    // TODO improve this url construction
    repoUrl = `https://${repoInfo.provider}.com/${repoInfo.remoteData.repo}`

    GIT_REMOTE_PROMPT = `Use current git remote url ${repoUrl}`

    // Add git GIT_REMOTE_PROMPT if in a repo. TODO refactor to non mutating
    LinkChoices.splice(0, 0, GIT_REMOTE_PROMPT)
  }

  context.log()
  context.log(`${chalk.cyanBright('netlify link')} will connect a site in app.netlify.com to this folder`)
  context.log()
  const { linkType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'linkType',
      message: 'How do you want to link this folder to a site?',
      choices: LinkChoices
    }
  ])

  switch (linkType) {
    case GIT_REMOTE_PROMPT: {
      if (repoInfo.error) {
        context.error(new Error(repoInfo.error))
      }

      if (isEmpty(repoInfo)) {
        context.error(new Error(`No git remote found in this directory`))
      }
      context.log()
      context.log(`Fetching sites and looking for site connected to "${repoUrl}" repo`)
      const sites = await api.listSites()

      if (isEmpty(sites)) {
        context.error(new Error(`No sites found in your netlify account`))
      }

      const matchingSites = sites.filter((s) => {
        const buildSettings = s.build_settings || {}
        return repoUrl === buildSettings.repo_url
      })

      // If no remote matches. Throw error
      if (isEmpty(matchingSites)) {
        context.log(chalk.redBright.bold.underline(`No Matching Site Found`))
        context.log()
        context.log((`No site found with the remote ${repoInfo.repo_path}.

Double check you are in the correct working directory & a remote git repo is configured.

Run ${chalk.cyanBright('`git remote -v`')} to see a list of your git remotes.`))

        context.exit()
      }

      // Matches a single site hooray!
      if (matchingSites.length === 1) {
        site = matchingSites[0]
      } else if (matchingSites.length > 1) {
        // Matches multiple sites. Users much choose which to link.
        console.log()
        console.log(`Found ${matchingSites.length} matching sites! Please choose one:`)

        const siteChoices = matchingSites.map((site) => {
          return `${site.ssl_url} - ${site.name} - ${site.id}`
        })

        // Prompt which options
        const { siteToConnect } = await inquirer.prompt([
          {
            type: 'list',
            name: 'siteToConnect',
            message: 'Which site do you want to link to?',
            choices: siteChoices
          }
        ])

        const siteName = siteToConnect.split(' ')[0]
        site = matchingSites.filter((site) => {
          const url = site.ssl_url || site.url
          return siteName === url
        })[0]
      }
      break
    }
    case SITE_NAME_PROMPT: {
      const { siteName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'siteName',
          message: 'What is the name of the site?'
        }
      ])
      let sites
      try {
        sites = await api.listSites({
          name: siteName,
          filter: 'all'
        })
      } catch (e) {
        if (e.status === 404) {
          context.error(`${siteName} not found`)
        } else {
          context.error(e)
        }
      }

      if (sites.length === 0) {
        context.error(`No sites found named ${siteName}`)
      }

      if (sites.length > 1) {
        const { selectedSite } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedSite',
            paginated: true,
            choices: sites.map(site => ({ name: site.name, value: site }))
          }
        ])
        if (!selectedSite) {
          context.error('No site selected')
        }
        site = selectedSite
      } else {
        site = sites[0]
      }
      break
    }
    case SITE_ID_PROMPT: {
      const { siteId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'siteId',
          message: 'What is the site-id of the site?'
        }
      ])

      try {
        site = await api.getSite({ siteId })
      } catch (e) {
        if (e.status === 404) {
          context.error(new Error(`Site id ${siteId} not found`))
        } else {
          context.error(e)
        }
      }
      break
    }
  }

  if (!site) {
    context.error(new Error(`No site found`))
  }

  // Save site ID to config
  state.set('siteId', site.id)

  // Log output
  context.log()
  context.log(chalk.greenBright.bold.underline(`Directory Linked`))
  context.log()
  context.log(`Admin url: ${chalk.magentaBright(site.admin_url)}`)
  context.log(`Site url:  ${chalk.cyanBright(site.ssl_url || site.url)}`)
  context.log()

  context.log(`Site id saved to ${context.netlify.site.root}`)
  // context.log(`Local Config: .netlify/config.json`)
  context.log()
  context.log(`You can now run other \`netlify\` cli commands in this directory`)

  return site
}
