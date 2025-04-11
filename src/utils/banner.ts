import boxen from 'boxen'

import { ansis, log, NETLIFYDEVLOG } from './command-helpers.js'

export const printBanner = (options: { url: string }): void => {
  const banner = ansis.bold(`${NETLIFYDEVLOG} Server now ready on ${options.url}`)

  log(
    boxen(banner, {
      padding: 1,
      margin: 1,
      align: 'center',
      borderColor: '#00c7b7',
    }),
  )
}
