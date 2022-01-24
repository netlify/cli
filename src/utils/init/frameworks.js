// @ts-check
const frameworkInfoPromise = import('@netlify/framework-info')

const getFrameworkInfo = async ({ baseDirectory, nodeVersion }) => {
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

module.exports = { getFrameworkInfo }
