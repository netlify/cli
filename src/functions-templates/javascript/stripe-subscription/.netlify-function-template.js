const chalk = require('chalk')

module.exports = {
  name: 'stripe-subscription',
  description: 'Stripe subscription: Create a subscription with Stripe',
  functionType: 'serverless',
  async onComplete() {
    console.log(`${chalk.yellow('stripe-subscription')} function created from template!`)
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log(
        `note this function requires ${chalk.yellow(
          'STRIPE_SECRET_KEY',
        )} build environment variable set in your Netlify Site.`,
      )
      let siteData = { name: 'YOURSITENAMEHERE' }
      try {
        siteData = await this.netlify.api.getSite({
          siteId: this.netlify.site.id,
        })
      } catch (e) {
        // silent error, not important
      }
      console.log(
        `Set it at: https://app.netlify.com/sites/${siteData.name}/settings/deploys#environment-variables (must have CD setup)`,
      )
    }
  },
}
