/**
 * Allows us to check if a feature flag is enabled for a site.
 * Due to versioning of the cli, and the desire to remove flags from
 * our feature flag service when they should always evaluate to true,
 * we can't just look for the presense of {featureFlagName: true}, as
 * the absense of a flag should also evaluate to the flag being enabled.
 * Instead, we return that the feature flag is enabled if it isn't
 * specifically set to false in the response
 */
export const isFeatureFlagEnabled = (flagName, siteInfo) => Boolean(siteInfo.feature_flags && siteInfo.feature_flags[flagName] !== false);
/**
 * Retrieves all Feature flags from the siteInfo
 */
export const getFeatureFlagsFromSiteInfo = (siteInfo) => ({
    ...siteInfo.feature_flags,
    // see https://github.com/netlify/pod-dev-foundations/issues/581#issuecomment-1731022753
    zisi_golang_use_al2: isFeatureFlagEnabled('cli_golang_use_al2', siteInfo),
    netlify_build_frameworks_api: true,
});
//# sourceMappingURL=feature-flags.js.map