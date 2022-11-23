// @ts-check
const process = require('process')

// eslint-disable-next-line no-restricted-modules
const { Instance: ChalkInstance } = require('chalk')
const logSymbols = require('log-symbols')
const ora = require('ora')

/**
 * Chalk instance for CLI that can be initialized with no colors mode
 * needed for json outputs where we don't want to have colors
 * @param  {boolean} noColors - disable chalk colors
 * @return {object} - default or custom chalk instance
 */
const safeChalk = function (noColors) {
  if (noColors) {
    const colorlessChalk = new ChalkInstance({ level: 0 })
    return colorlessChalk
  }
  return new ChalkInstance()
}
/** The parsed process argv without the binary only arguments and flags */
const argv = process.argv.slice(2)

const chalk = safeChalk(argv.includes('--json'))

/**
 * Gradient spinner animation from: https://github.com/withastro/astro/blob/97e2b6ad7a6fa23e82be28b2f57cdf3f85fab112/packages/create-astro/src/gradient.ts#L38
 */

const gradientColors = [
  `#061475`,
  `#0a1e8d`,
  `#112caf`,
  `#183dd1`,
  `#2250f4`,
  `#587ef8`,
  `#84f3df`,
  `#5cebdf`,
  `#30c8c9`,
  `#0f6a80`,
]

// get a reference to scroll through while loading
// visual representation of what this generates:
// gradientColors: "..xxXX"
// referenceGradient: "..xxXXXXxx....xxXX"
const referenceGradient = [
  ...gradientColors,
  // draw the reverse of the gradient without
  // accidentally mutating the gradient (ugh, reverse())
  ...[...gradientColors].reverse(),
  ...gradientColors,
]

const getGradientAnimFrames = () => {
  const frames = []
  // eslint-disable-next-line fp/no-loops
  for (let start = 0; start < gradientColors.length * 2; start++) {
    const end = start + gradientColors.length - 1
    frames.push(
      referenceGradient
        .slice(start, end)
        .map((gcolor) => chalk.bgHex(gcolor)(' '))
        .join(''),
    )
  }
  return frames
}

/**
 * Creates a spinner with the following text
 * @param {object} config
 * @param {string} config.text
 * @returns {ora.Ora}
 */
const startSpinner = ({ text }) => {
  const frames = getGradientAnimFrames()
  return ora({
    spinner: {
      // eslint-disable-next-line no-magic-numbers
      interval: 60,
      frames,
    },
    text: `✨ ${text}`,
  }).start()
}

/**
 * Stops the spinner with the following text
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @param {object} [config.error]
 * @param {string} [config.text]
 * @returns {void}
 */
const stopSpinner = ({ error, spinner, text }) => {
  if (!spinner) {
    return
  }
  // TODO: refactor no package needed `log-symbols` for that
  const symbol = error ? logSymbols.error : logSymbols.success
  spinner.stopAndPersist({
    text,
    symbol,
  })
}

/**
 * Clears the spinner
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @returns {void}
 */
const clearSpinner = ({ spinner }) => {
  if (spinner) {
    spinner.stop()
  }
}

module.exports = { clearSpinner, startSpinner, stopSpinner }
