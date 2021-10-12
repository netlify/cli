const chalk = require('chalk')

module.exports = {
  name: 'stripe-charge',
  description: 'Stripe Charge: Charge a user with Stripe',
  async onComplete() {
    console.log(`${chalk.yellow('stripe-charge')} function created from template!`)
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
