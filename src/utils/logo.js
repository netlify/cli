const chalk = require("chalk")

module.exports = {
  NETLIFYDEV: `${chalk.greenBright("◈")} ${chalk.rgb(40, 180, 170)("Netlify Dev")} ${chalk.greenBright("◈")}`,
  NETLIFYDEVLOG: `${chalk.greenBright("◈")}`,
  NETLIFYDEVWARN: `${chalk.yellowBright("◈")}`,
  NETLIFYDEVERR: `${chalk.redBright("◈")}`
}
