// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isPluginInstalled = (configPlugins: $TSFixMe, plugin: $TSFixMe) =>
  // @ts-expect-error TS(7031): Binding element 'configPlugin' implicitly has an '... Remove this comment to see the full error message
  configPlugins.some(({ package: configPlugin }) => configPlugin === plugin)

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getRecommendPlugins = (frameworkPlugins: $TSFixMe, config: $TSFixMe) =>
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  frameworkPlugins.filter((plugin: $TSFixMe) => !isPluginInstalled(config.plugins, plugin))

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getUIPlugins = (configPlugins: $TSFixMe) => configPlugins.filter(({ origin }: $TSFixMe) => origin === 'ui').map(({ package: configPackage }: $TSFixMe) => ({ package: configPackage }))

export default { getRecommendPlugins, getUIPlugins }
