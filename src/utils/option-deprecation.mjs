import { chalk, log, NETLIFYDEVWARN } from './command-helpers.mjs'

// This file contains logic for flags in camelcase that will be deprecated in v13 and replaced in kebab-case.
// Flags to be deprecated in v13
const DEPRECATED_OPTIONS = {
  httpProxy: { option: '--httpProxy', newOption: '--http-proxy', deprecatedVersion: 'v13' },
}

// TODO v13: remove all options that use this function
export const deprecatedArgParser = (value) => ({
  value,
  deprecationWarn: true,
})

// TODO v13: remove all uses of this function in the code so they can fall back on just using `option` instead of `option.value`
export const returnDeprecatedOptionValue = (option) => (option.value ? option.value : option)

export const warnForDeprecatedOptions = (options) => {
  Object.entries(options).forEach(([option, value]) => {
    const deprecatedOption = DEPRECATED_OPTIONS[option]

    if (value.deprecationWarn && deprecatedOption) {
      log(
        NETLIFYDEVWARN,
        chalk.yellowBright(
          `The flag ${deprecatedOption.option} is replaced by ${deprecatedOption.newOption} and will be deprecated in ${deprecatedOption.deprecatedVersion}`,
        ),
      )
    }
  })
}
