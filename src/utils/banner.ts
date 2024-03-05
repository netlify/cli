import boxen from 'boxen'

import { chalk, log, NETLIFYDEVLOG } from './command-helpers.js'

export const printBanner = (options: { url: string }): void => {
  const banner = chalk.bold(`${NETLIFYDEVLOG} Server now ready on ${options.url}`)

  log(
    boxen(banner, {
      padding: 1,
      margin: 1,
      align: 'center',
      borderColor: '#00c7b7',
    }),
  )
}
