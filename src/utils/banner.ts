import boxen from 'boxen'

import { chalk, NETLIFYDEVLOG } from './command-helpers.js'
import { NetlifyLog } from './styles/index.js'

export const printBanner = (options: { url: string }): void => {
  const banner = chalk.bold(`${NETLIFYDEVLOG} Server now ready on ${options.url}`)

  NetlifyLog.message(
    boxen(banner, {
      padding: 1,
      margin: 1,
      align: 'center',
      borderColor: '#00c7b7',
    }),
  )
}
