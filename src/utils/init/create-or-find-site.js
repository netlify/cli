const inquirer = require('inquirer')
const SitesCreateCommand = require('../../commands/sites/create')
const linkPrompt = require('../link/link-by-prompt')
const get = require('lodash.get')

module.exports = createOrFindSite
async function createOrFindSite(ctx, flags) {
  // TODO Encapsulate this better
  // Prompt existing site
  // or Create a new site
  // or Search for an existing site

  const NEW_SITE_PROMPT = 'Configure a new site'
  const EXISTING_SITE_PROMPT = 'Link to an existing site'

  const siteOpts = [NEW_SITE_PROMPT, EXISTING_SITE_PROMPT]

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
      message: 'What would you like to do?',
      choices: siteOpts
    }
  ])

  let site
  // create site or search for one
  if (configureOption === NEW_SITE_PROMPT) {
    site = await SitesCreateCommand.run([])
  } else if (configureOption === 'linked-site') {
    site = linkedSite
  } else {
    await linkPrompt(ctx)
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
