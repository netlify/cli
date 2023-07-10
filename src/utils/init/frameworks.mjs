// @ts-check

/**
 * @param {{ project: import("@netlify/build-info").Project }} param0
 * @returns
 */
export const getFrameworkInfo = async ({ project }) => {
  const settings = await project.getBuildSettings()
  // several frameworks can be detected - first one has highest priority
  if (settings?.length) {
    return {
      frameworkName: settings[0].framework?.name,
      frameworkBuildCommand: settings[0].buildCommand,
      frameworkBuildDir: settings[0].dist,
      frameworkPlugins: settings[0].plugins_recommended,
    }
  }
  return {}
}
