const chalk = require('chalk')

module.exports = header
function header(context) {
  const title = chalk.cyanBright.bold.underline('Netlify CLI')
  const docsMsg = `${chalk.greenBright('Read the docs:')} https://cli.netlify.com`
  const forumMsg = `${chalk.yellowBright('Discuss on the forums:')} https://gitter.netlify.com`
  if (!context.id) {
    console.log()
    console.log(`${title}`)
    console.log(docsMsg)
    console.log(forumMsg)
    console.log()
  }
}
