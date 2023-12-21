/**
 * Allows us to check if a feature flag is enabled for a site.
 * Due to versioning of the cli, and the desire to remove flags from
 * our feature flag service when they should always evaluate to true,
 * we can't just look for the presense of {featureFlagName: true}, as
 * the absense of a flag should also evaluate to the flag being enabled.
 * Instead, we return that the feature flag is enabled if it isn't
 * specifically set to false in the response
 * @param {*} siteInfo
 *
 * @returns {boolean}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'flagName' implicitly has an 'any' type.
export const isFeatureFlagEnabled = (flagName: string, siteInfo): boolean =>
  Boolean(siteInfo.feature_flags && siteInfo.feature_flags[flagName] !== false)
