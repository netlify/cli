// @ts-check
import ansiStyles from 'ansi-styles'

import { chalk } from '../../command-helpers.js'

const colorTheme = {
  boolean: ansiStyles.yellow,
  circular: chalk.grey('[Circular]'),
  date: {
    invalid: chalk.red('invalid'),
    value: ansiStyles.blue,
  },
  diffGutters: {
    actual: `${chalk.red('-')} `,
    expected: `${chalk.green('+')} `,
    padding: '  ',
  },
  error: {
    ctor: {
      open: `${ansiStyles.grey.open}(`,
      close: `)${ansiStyles.grey.close}`,
    },
    name: ansiStyles.magenta,
  },
  function: {
    name: ansiStyles.blue,
    stringTag: ansiStyles.magenta,
  },
  global: ansiStyles.magenta,
  item: {
    after: chalk.grey(','),
  },
  list: {
    openBracket: chalk.grey('['),
    closeBracket: chalk.grey(']'),
  },
  mapEntry: {
    after: chalk.grey(','),
  },
  maxDepth: chalk.grey('…'),
  null: ansiStyles.yellow,
  number: ansiStyles.yellow,
  object: {
    openBracket: chalk.grey('{'),
    closeBracket: chalk.grey('}'),
    ctor: ansiStyles.magenta,
    stringTag: {
      open: `${ansiStyles.magenta.open}@`,
      close: ansiStyles.magenta.close,
    },
    secondaryStringTag: {
      open: `${ansiStyles.grey.open}@`,
      close: ansiStyles.grey.close,
    },
  },
  property: {
    after: chalk.grey(','),
    keyBracket: { open: chalk.grey('['), close: chalk.grey(']') },
    valueFallback: chalk.grey('…'),
  },
  regexp: {
    source: {
      open: `${ansiStyles.blue.open}/`,
      close: `/${ansiStyles.blue.close}`,
    },
    flags: ansiStyles.yellow,
  },
  stats: { separator: chalk.grey('---') },
  string: {
    open: ansiStyles.white.open,
    close: ansiStyles.white.close,
    line: { open: chalk.white("'"), close: chalk.white("'") },
    multiline: { start: chalk.white('`'), end: chalk.white('`') },
    controlPicture: ansiStyles.grey,
    diff: {
      insert: {
        open: ansiStyles.bgGreen.open + ansiStyles.black.open,
        close: ansiStyles.black.close + ansiStyles.bgGreen.close,
      },
      delete: {
        open: ansiStyles.bgRed.open + ansiStyles.black.open,
        close: ansiStyles.black.close + ansiStyles.bgRed.close,
      },
      equal: ansiStyles.white,
      insertLine: {
        open: ansiStyles.green.open,
        close: ansiStyles.green.close,
      },
      deleteLine: {
        open: ansiStyles.red.open,
        close: ansiStyles.red.close,
      },
    },
  },
  symbol: ansiStyles.yellow,
  typedArray: {
    bytes: ansiStyles.yellow,
  },
  undefined: ansiStyles.yellow,
}

const plugins = []
const theme = colorTheme

export const concordanceOptions = { maxDepth: 3, plugins, theme }
export const concordanceDiffOptions = { maxDepth: 1, plugins, theme }
