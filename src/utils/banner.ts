import boxen from 'boxen'

import { chalk, log, NETLIFYDEVLOG } from './command-helpers.js'

export const printBanner = ({ url }: { url: string }) => {
  const banner = chalk.bold(`${NETLIFYDEVLOG} Server now ready on ${url}`)

  log(
    boxen(banner, {
      padding: 1,
      margin: 1,
      align: 'center',
      borderColor: '#00c7b7',
    }),
  )
}
