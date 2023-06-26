// @ts-checkom '@netlify/build-info'

/**
 * @param {{ project: import("@netlify/build-info").Project }} param0
 * @returns
 */
export const getFrameworkInfo = async ({ project }) => {
  const frameworks = await project.detectFrameworks()
  // several frameworks can be detected - first one has highest priority
  if (frameworks && frameworks.length !== 0) {
    const [
      {
        build: { command, directory },
        name,
        plugins,
      },
    ] = frameworks
    return {
      frameworkName: name,
      frameworkBuildCommand: command,
      frameworkBuildDir: directory,
      frameworkPlugins: plugins,
    }
  }
  return {}
}
