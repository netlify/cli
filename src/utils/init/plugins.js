// @ts-expect-error TS(7006) FIXME: Parameter 'configPlugins' implicitly has an 'any' ... Remove this comment to see the full error message
const isPluginInstalled = (configPlugins, plugin) => 
// @ts-expect-error TS(7031) FIXME: Binding element 'configPlugin' implicitly has an '... Remove this comment to see the full error message
configPlugins.some(({ package: configPlugin }) => configPlugin === plugin);
// @ts-expect-error TS(7006) FIXME: Parameter 'frameworkPlugins' implicitly has an 'an... Remove this comment to see the full error message
export const getRecommendPlugins = (frameworkPlugins, config) => 
// @ts-expect-error TS(7006) FIXME: Parameter 'plugin' implicitly has an 'any' type.
frameworkPlugins.filter((plugin) => !isPluginInstalled(config.plugins, plugin));
// @ts-expect-error TS(7006) FIXME: Parameter 'configPlugins' implicitly has an 'any' ... Remove this comment to see the full error message
export const getUIPlugins = (configPlugins) => 
// @ts-expect-error TS(7031) FIXME: Binding element 'origin' implicitly has an 'any' t... Remove this comment to see the full error message
configPlugins.filter(({ origin }) => origin === 'ui').map(({ package: pkg }) => ({ package: pkg }));
