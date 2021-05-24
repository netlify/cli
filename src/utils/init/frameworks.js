const { listFrameworks } = require('@netlify/framework-info')

const getFrameworkInfo = async ({ baseDirectory, nodeVersion }) => {
  const frameworks = await listFrameworks({ projectDir: baseDirectory, nodeVersion })
  // several frameworks can be detected - first one has highest priority
  if (frameworks.length !== 0) {
    const [
      {
        name,
        build: { directory, commands },
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
