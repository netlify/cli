const chalk = require('chalk')

module.exports = {
  name: 'url-shortener',
  description: 'URL Shortener: simple URL shortener with Netlify Forms!',
  async onComplete() {
    console.log(`${chalk.yellow('url-shortener')} function created from template!`)
    if (!process.env.ROUTES_FORM_ID || !process.env.API_AUTH) {
      console.log(
        `note this function requires ${chalk.yellow('ROUTES_FORM_ID')} and ${chalk.yellow(
          'API_AUTH'
        )} build environment variables set in your Netlify Site.`
      )

      let siteData = { name: 'YOURSITENAMEHERE' }
      try {
        siteData = await this.netlify.api.getSite({
          siteId: this.netlify.site.id
        })
      } catch (e) {
        // silent error, not important
      }
      console.log(
        `Set them at: https://app.netlify.com/sites/${siteData.name}/settings/deploys#environment-variables (must have CD setup)`
      )
    }
  }
}
