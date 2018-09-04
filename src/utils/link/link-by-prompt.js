const path = require('path')
const inquirer = require('inquirer')
const chalk = require('chalk')
const getRepoData = require('../getRepoData')
const isEmpty = require('lodash.isempty')

module.exports = async function linkBy(context) {
  const REMOTE_PROMPT = 'Use current git remote URL'
  const SITE_NAME_PROMPT = 'Site Name'
  const SITE_ID_PROMPT = 'Site ID'
  // Get remote data if exists
  const repoInfo = await getRepoData()

  const LinkChoices = [
    SITE_NAME_PROMPT,
    SITE_ID_PROMPT
  ]

  if (!repoInfo.error) {
    // Add git REMOTE_PROMPT if in a repo. TODO refactor to non mutating
    LinkChoices.splice(0, 0, REMOTE_PROMPT)
  }

  const { linkType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'linkType',
      message: 'How do you want to link this folder to a site?',
      choices: LinkChoices
    }
  ])

  switch (linkType) {
    case REMOTE_PROMPT: {
      let site
      const sites = await context.netlify.listSites()

      if (repoInfo.error) {
        context.error(new Error(repoInfo.error))
      }

      if (isEmpty(repoInfo)) {
        context.error(new Error(`No git remote found in this directory`))
      }

      // TODO improve this url construction
      const repoUrl = `https://${repoInfo.provider}.com/${repoInfo.remoteData.repo}`

      if (isEmpty(sites)) {
        context.error(new Error(`No sites found in your netlify account`))
      }

      const matchingSites = sites.filter((site) => {
        return repoUrl === site.build_settings.repo_url
      })

      // If no remote matches. Throw error
      if (isEmpty(matchingSites)) {
        context.error(new Error(`No site found with the remote ${repoInfo.repo_path}.

Double check you are in the correct working directory & a remote git repo is configured.

Run ${chalk.cyanBright('`git remote -v`')} to see a list of your git remotes.`))
      }

      // Matches a single site hooray!
      if (matchingSites.length === 1) {
        site = matchingSites[0]
      } else if (matchingSites.length > 1) {
        // Matches multiple sites. Users much choose which to link.
        console.log(`${matchingSites.length} matching sites! Please choose one:`)

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
          // TODO does every site have ssl_url?
          return siteName === site.ssl_url
        })[0]
      }

      linkSite(site, context)
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
        sites = await context.netlify.listSites({
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
      let site
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
      linkSite(site, context)
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

      let site
      try {
        site = await context.netlify.getSite({ siteId })
      } catch (e) {
        if (e.status === 404) {
          context.error(new Error(`Site id ${siteId} not found`))
        } else {
          context.error(e)
        }
      }
      linkSite(site, context)
      break
    }
  }
}

function linkSite(site, context) {
  if (!site) {
    context.error(new Error(`No site found`))
  }
  context.site.set('siteId', site.id)
  context.log(`This directory is now linked to site "${site.name}"`)
  console.log(`Site ID ${site.id} saved to ${path.relative(path.join(process.cwd(), '..'), context.site.path)}`)
  context.log()
  context.log(`You can now run other \`netlify\` cli commands in this directory`)
  context.exit()
}
