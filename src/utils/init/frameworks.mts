// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module '@net... Remove this comment to see the full error message
const frameworkInfoPromise = import('@netlify/framework-info')

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

export default { getFrameworkInfo }
