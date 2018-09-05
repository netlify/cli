const chalk = require('chalk')
const pkg = require('../../package.json')

module.exports = function header(context) {
  const title = chalk.cyanBright.bold.underline('Netlify CLI (BETA)')
  const docsMsg = `${chalk.greenBright('Read the docs:')} https://cli.netlify.com`
  const supportMsg = `${chalk.magentaBright('Support and bugs:')} ${pkg.bugs}`
  if (!context.id) {
    console.log()
    console.log(title)
    console.log(docsMsg)
    console.log(supportMsg)
    console.log()
  }
}
