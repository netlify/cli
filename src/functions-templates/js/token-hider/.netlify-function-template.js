const chalk = require('chalk')

module.exports = {
  name: 'token-hider',
  description: 'Token Hider: access APIs without exposing your API keys',
  async onComplete() {
    console.log(`${chalk.yellow('token-hider')} function created from template!`)
    if (!process.env.API_URL || !process.env.API_TOKEN) {
      console.log(
        `note this function requires ${chalk.yellow('API_URL')} and ${chalk.yellow(
          'API_TOKEN'
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
