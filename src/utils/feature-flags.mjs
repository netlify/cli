/**
 * Allows us to check if a feature flag is enabled for a site.
 * Due to versioning of the cli, and the desire to remove flags from
 * our feature flag service when they should always evaluate to true,
 * we can't just look for the presense of {featureFlagName: true}, as
 * the absense of a flag should also evaluate to the flag being enabled.
 * Instead, we return that the feature flag is enabled if it isn't
 * specifically set to false in the response
 * @param {*} siteInfo
 * @param {string} flagName
 *
 * @returns {boolean}
 */
export const isFeatureFlagEnabled = (flagName, siteInfo) => {
  if (siteInfo.feature_flags && siteInfo.feature_flags[flagName] !== false) {
    return true
  }
  return false
}
