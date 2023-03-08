// @ts-check
import { BANG, chalk } from './command-helpers.mjs'

export const getGeoCountryArgParser = (exampleCommand) => (arg) => {
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
