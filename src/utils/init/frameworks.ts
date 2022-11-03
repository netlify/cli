// @ts-check
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module '@net... Remove this comment to see the full error message
const frameworkInfoPromise = import('@netlify/framework-info')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getFramewo... Remove this comment to see the full error message
const getFrameworkInfo = async ({
  baseDirectory,
  nodeVersion
}: $TSFixMe) => {
  const { listFrameworks } = await frameworkInfoPromise
  const frameworks = await listFrameworks({ projectDir: baseDirectory, nodeVersion })
  // several frameworks can be detected - first one has highest priority
  if (frameworks.length !== 0) {
    const [
      {
        build: { commands, directory },
        name,
        plugins,
      },
    ] = frameworks
    return {
      frameworkName: name,
      frameworkBuildCommand: commands[0],
      frameworkBuildDir: directory,
      frameworkPlugins: plugins,
    }
  }
  return {}
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { getFrameworkInfo }
