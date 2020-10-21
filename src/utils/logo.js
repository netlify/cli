const chalk = require('chalk')

// eslint-disable-next-line no-magic-numbers
const NETLIFY_CYAN = chalk.rgb(40, 180, 170)

module.exports = {
  NETLIFYDEV: `${chalk.greenBright('◈')} ${NETLIFY_CYAN('Netlify Dev')} ${chalk.greenBright('◈')}`,
  NETLIFYDEVLOG: `${chalk.greenBright('◈')}`,
  NETLIFYDEVWARN: `${chalk.yellowBright('◈')}`,
  NETLIFYDEVERR: `${chalk.redBright('◈')}`,
}
