import process from 'process'

import open from 'open'
import isDockerContainer from 'is-docker'

import { chalk, log } from './command-helpers.js'

type BrowserUnableMessage = {
  message: string
  url: string
}

const unableToOpenBrowserMessage = function ({ message, url }: BrowserUnableMessage) {
  log('---------------------------')
  log(chalk.redBright(`Error: Unable to open browser automatically: ${message}`))
  log(chalk.cyan('Please open your browser and open the URL below:'))
  log(chalk.bold(url))
  log('---------------------------')
}

type OpenBrowsrProps = {
  silentBrowserNoneError?: boolean
  url: string
}

const openBrowser = async function ({ silentBrowserNoneError, url }: OpenBrowsrProps) {
  if (isDockerContainer()) {
    unableToOpenBrowserMessage({ url, message: 'Running inside a docker container' })
    return
  }
  if (process.env.BROWSER === 'none') {
    if (!silentBrowserNoneError) {
      unableToOpenBrowserMessage({ url, message: "BROWSER environment variable is set to 'none'" })
    }
    return
  }

  try {
    await open(url)
  } catch (error) {
    if (error instanceof Error) {
      unableToOpenBrowserMessage({ url, message: error.message })
    }
  }
}

export default openBrowser
