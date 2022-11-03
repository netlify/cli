// @ts-expect-error TS(7006) FIXME: Parameter 'configPlugins' implicitly has an 'any' ... Remove this comment to see the full error message
const isPluginInstalled = (configPlugins, plugin) =>
  // @ts-expect-error TS(7031) FIXME: Binding element 'configPlugin' implicitly has an '... Remove this comment to see the full error message
  configPlugins.some(({ package: configPlugin }) => configPlugin === plugin)

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getRecomme... Remove this comment to see the full error message
const getRecommendPlugins = (frameworkPlugins, config) =>
  // @ts-expect-error TS(7006) FIXME: Parameter 'plugin' implicitly has an 'any' type.
  frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins, plugin))

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getUIPlugi... Remove this comment to see the full error message
const getUIPlugins = (configPlugins) =>
  // @ts-expect-error TS(1212) FIXME: Identifier expected. 'package' is a reserved word ... Remove this comment to see the full error message
  configPlugins.filter(({ origin }) => origin === 'ui').map(({ package }) => ({ package }))

module.exports = { getRecommendPlugins, getUIPlugins }
