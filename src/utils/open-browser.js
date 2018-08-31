const cli = require('cli-ux').default
const chalk = require('chalk')
const isDockerContainer = require('is-docker')

function unableToOpenBrowserMessage(url, err) {
  // https://github.com/sindresorhus/log-symbols
  console.log('---------------------------')
  const errMsg = err ? `\n${err.message}` : ''
  const msg = `Error: Unable to open browser automatically${errMsg}\n`
  console.log(`${chalk.redBright(msg)}`)
  console.log(chalk.greenBright('Please open your browser & open the URL below to login:'))
  console.log(chalk.whiteBright(url))
  console.log('---------------------------')
  return Promise.resolve()
}

async function openBrowser(url) {
  let browser = process.env.BROWSER
  if (browser === 'none' || isDockerContainer()) {
    return unableToOpenBrowserMessage(url)
  }
  if (process.platform === 'darwin' && browser === 'open') {
    browser = undefined
  }

  await cli.open(url).catch(err => {
    unableToOpenBrowserMessage(url, err)
  })
}

module.exports = openBrowser
