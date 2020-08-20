/* eslint no-console: 0 */

// reusable code for netlify dev
// bit of a hasty abstraction but recommended by oclif
const { getAddons } = require('netlify/src/addons')
const chalk = require('chalk')
const {
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('./logo')
/**
 * inject environment variables from netlify addons and buildbot
 * into your local dev process.env
 *
 * ```
 * // usage example
 * const { api, site } = this.netlify
 * if (site.id) {
 *   const addonUrls = await addEnvVariables(api, site)
 *   // addonUrls is only for startProxy in netlify dev:index
 * }
 * ```
 */
async function addEnvVariables(api, site) {
  /** from addons */
  const addonUrls = {}
  const addons = await getAddons(site.id, api.accessToken).catch(error => {
    console.error(error)
    switch (error.status) {
      default:
        console.error(
          `${NETLIFYDEVERR} Error retrieving addons data for site ${chalk.yellow(
            site.id
          )}. Double-check your login status with 'netlify status' or contact support with details of your error.`
        )
        process.exit()
    }
  })
  if (Array.isArray(addons)) {
    addons.forEach(addon => {
      addonUrls[addon.slug] = `${addon.config.site_url}/.netlify/${addon.slug}`
      for (const key in addon.env) {
        const msg = () =>
          console.log(`${NETLIFYDEVLOG} Injected ${chalk.yellow.bold('addon')} env var: `, chalk.yellow(key))
        process.env[key] = assignLoudly(process.env[key], addon.env[key], msg)
      }
    })
  }

  /** from web UI */
  const [apiSite, accounts] = await Promise.all([api.getSite({ site_id: site.id }), api.listAccountsForUser()]).catch(
    error => {
      console.error(error)
      switch (error.status) {
        case 401:
          console.error(
            `${NETLIFYDEVERR} Unauthorized error: This Site ID ${chalk.yellow(
              site.id
            )} does not belong to your account.`
          )
          console.error(
            `${NETLIFYDEVERR} If you cloned someone else's code, try running 'npm unlink' and then 'npm init' or 'npm link'.`
          )

          process.exit()
        // eslint-disable-next-line no-fallthrough
        default:
          console.error(
            `${NETLIFYDEVERR} Error retrieving site data for site ${chalk.yellow(
              site.id
            )}. Double-check your login status with 'netlify status' or contact support with details of your error.`
          )
          process.exit()
      }
    }
  )
  // TODO: We should move the environment outside of build settings and possibly have a
  // `/api/v1/sites/:site_id/environment` endpoint for it that we can also gate access to
  // In the future and that we could make context dependend
  if (apiSite.build_settings && apiSite.build_settings.env) {
    for (const key in apiSite.build_settings.env) {
      const msg = () =>
        console.log(`${NETLIFYDEVLOG} Injected ${chalk.blue.bold('build setting')} env var: ${chalk.yellow(key)}`)
      process.env[key] = assignLoudly(process.env[key], apiSite.build_settings.env[key], msg)
    }
  }

  const siteAccount = accounts.find(acc => acc.slug === apiSite.account_slug)
  if (siteAccount && siteAccount.site_env) {
    for (const key in siteAccount.site_env) {
      const msg = () =>
        console.log(
          `${NETLIFYDEVLOG} Injected ${chalk.blue.bold('shared build setting')} env var: ${chalk.yellow(key)}`
        )
      process.env[key] = assignLoudly(process.env[key], siteAccount.site_env[key], msg)
    }
  }

  return addonUrls
}

module.exports = {
  addEnvVariables,
}

// if first arg is undefined, use default, but tell user about it in case it is unintentional
function assignLoudly(
  optionalValue,
  defaultValue,
  tellUser = dV => console.log(`No value specified, using fallback of `, dV)
) {
  if (defaultValue === undefined) throw new Error('must have a defaultValue')
  if (defaultValue !== optionalValue && optionalValue === undefined) {
    tellUser(defaultValue)
    return defaultValue
  }
  return optionalValue
}
