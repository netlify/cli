const chalk = require('chalk')
const pkg = require('../../package.json')

module.exports = function header(context) {
  const title = `${chalk.bgBlack.cyan('⬥ Netlify CLI')}`
  const docsMsg = `${chalk.greenBright('Read the docs:')} https://www.netlify.com/docs/cli`
  const supportMsg = `${chalk.magentaBright('Support and bugs:')} ${pkg.bugs.url}`

  // If not command show header
  if (!context.id) {
    console.log()
    console.log(title)
    console.log(docsMsg)
    console.log(supportMsg)
    console.log()
  }
}
