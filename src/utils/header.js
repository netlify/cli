const chalk = require('chalk')
const pkg = require('../../package.json')

module.exports = function header(context) {
  const title = chalk.cyanBright.bold.underline('Netlify CLI')
  const nextWarning = `${chalk.redBright.bold('****ALPHA RELEASE**** (Not feature complete)')}`
  const docsMsg = `${chalk.greenBright('Read the docs:')} https://cli.netlify.com`
  const forumMsg = `${chalk.yellowBright('Discuss on the forums:')} https://gitter.netlify.com`
  const supportMsg = `${chalk.magentaBright('Support and bugs:')} ${pkg.bugs}`
  if (!context.id) {
    console.log()
    console.log(title)
    console.log(nextWarning)
    console.log(docsMsg)
    console.log(forumMsg)
    console.log(supportMsg)
    console.log()
  }
}
