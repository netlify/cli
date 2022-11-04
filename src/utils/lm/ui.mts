// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'os'.
const os = require('os')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'boxen'.
const boxen = require('boxen')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, log } = require('../command-helpers.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getShellIn... Remove this comment to see the full error message
const { getShellInfo, isBinInPath } = require('./install.cjs')

/**
 * @param {boolean} force
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'printBanne... Remove this comment to see the full error message
const printBanner = function (force: $TSFixMe) {
  const print = force || !isBinInPath()
  const platform = os.platform()

  if (print && platform !== 'win32') {
    const { incFilePath } = getShellInfo()
    const banner = chalk.bold(
      `Run this command to use Netlify Large Media in your current shell\n\nsource ${incFilePath}`,
    )

    log(boxen(banner, { padding: 1, margin: 1, align: 'center', borderColor: '#00c7b7' }))
  }
}

module.exports = { printBanner }
