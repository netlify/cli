import { BANG, chalk } from './command-helpers.js';
/**
 * @param {string} exampleCommand
 * @returns {(value:string, previous: unknown) => unknown}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'exampleCommand' implicitly has an 'any'... Remove this comment to see the full error message
export const getGeoCountryArgParser = (exampleCommand) => (arg) => {
    // Validate that the arg passed is two letters only for country
    // See https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
    if (!/^[a-z]{2}$/i.test(arg)) {
        throw new Error(`The geo country code must use a two letter abbreviation.
      ${chalk.red(BANG)}  Example:
      ${exampleCommand}`);
    }
    return arg.toUpperCase();
};
