import { InvalidArgumentError } from 'commander'

import { BANG, chalk } from './command-helpers.js'

const MAX_SITE_NAME_LENGTH = 63

export const validateSiteName = (value: string): string => {
  if (value.length > MAX_SITE_NAME_LENGTH) {
    throw new InvalidArgumentError(`--name should be less than 64 characters, input length: ${value.length.toString()}`)
  }
  if (!/^[a-zA-Z\d-]+$/.test(value)) {
    throw new InvalidArgumentError('--name can only contain alphanumeric characters and hyphens')
  }
  return value
}

export const getGeoCountryArgParser = (exampleCommand: string) => (arg: string) => {
  // Validate that the arg passed is two letters only for country
  // See https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
  if (!/^[a-z]{2}$/i.test(arg)) {
    throw new Error(
      `The geo country code must use a two letter abbreviation.
      ${chalk.red(BANG)}  Example:
      ${exampleCommand}`,
    )
  }
  return arg.toUpperCase()
}
