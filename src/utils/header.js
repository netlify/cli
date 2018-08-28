const chalk = require('chalk')

module.exports = function header(context) {
  const title = chalk.cyanBright.bold.underline('Netlify CLI')
  const nextWarning = chalk.redBright.bold('***ALPHA RELEASE**** (Not feature complete)')
  const docsMsg = `${chalk.greenBright('Read the docs:')} https://cli.netlify.com`
  const forumMsg = `${chalk.yellowBright('Discuss on the forums:')} https://gitter.netlify.com`
  if (!context.id) {
    console.log()
    console.log(`${title}`)
    console.log(nextWarning)
    console.log(docsMsg)
    console.log(forumMsg)
    console.log()
  }
}
