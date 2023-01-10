// @ts-check
import boxen from 'boxen'

import { chalk, log, NETLIFYDEVLOG } from './command-helpers.mjs'

export const printBanner = ({ url }) => {
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
