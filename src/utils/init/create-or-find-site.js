const inquirer = require('inquirer')
const SitesCreateCommand = require('../../commands/sites/create')
const get = require('lodash.get')

module.exports = createOrFindSite
async function createOrFindSite(ctx, flags) {
  // TODO Encapsulate this better
  // Prompt existing site
  // or Create a new site
  // or Search for an existing site
  const siteOpts = ['New site', 'Existing site']

  let linkedSite
  if (ctx.site.get('siteId')) {
    try {
      linkedSite = await ctx.netlify.getSite({ siteId: ctx.site.get('siteId') })
    } catch (_) {
      // noop
    }

    if (linkedSite) {
      siteOpts.unshift({
        name: `Linked site (${linkedSite.name})`,
        value: 'linked-site'
      })
    }
  }

  const { configureOption } = await inquirer.prompt([
    {
      type: 'list',
      name: 'configureOption',
      message: 'Site to configure:',
      choices: siteOpts
    }
  ])

  let site
  // create site or search for one
  if (configureOption === 'New site') {
    site = await SitesCreateCommand.run([])
  } else if (configureOption === 'linked-site') {
    site = linkedSite
  } else {
    // TODO share this with link site search step
    const { searchType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'searchType',
        message: 'Search for site by:',
        choices: ['Site Name', 'Site ID']
      }
    ])

    switch (searchType) {
      case 'Site Name': {
        const { siteName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'siteName',
            message: 'Search by site name:'
          }
        ])

        const sites = await ctx.netlify.listSites({
          name: siteName,
          filter: 'all'
        })
        if (sites.length === 0) {
          ctx.error(`No sites found named ${siteName}`)
        }

        if (sites.length > 1) {
          const { siteName } = await inquirer.prompt([
            {
              type: 'list',
              name: 'name',
              paginated: true,
              choices: sites.map(site => site.name)
            }
          ])
          site = sites.find(site => (site.name = siteName))
          if (!site) ctx.error('No site selected')
        } else {
          site = sites[0]
        }
        break
      }
      case 'Site ID': {
        const { siteId } = await inquirer.prompt([
          {
            type: 'input',
            name: 'siteId',
            message: 'What is the site-id of the site?'
          }
        ])

        try {
          site = await ctx.netlify.getSite({ siteId })
        } catch (e) {
          if (e.status === 404) ctx.error(`Site id ${siteId} not found`)
          else ctx.error(e)
        }
        break
      }
    }
  }
  if (get(site, 'build_settings.repo_url')) {
    if (flags.force) {
      ctx.warn(
        `${get(site, 'name')} already configured to automatically deploy from ${get(site, 'build_settings.repo_url')}`
      )
    } else {
      ctx.error(
        `${get(site, 'name')} already configured to automatically deploy from ${get(
          site,
          'build_settings.repo_url'
        )}. Use --force to override`
      )
    }
  }
  ctx.site.set('siteId', site.id)
  return site
}
