// @ts-check

/**
 * Detects and filters the build setting for a project and a command
 * @param {import('../commands/base-command.mjs').default} command
 */
export const detectBuildSettings = async (command) => {
  const { project, workspacePackage } = command
  const buildSettings = await project.getBuildSettings(project.workspace ? workspacePackage : '')
  return buildSettings
    .filter((setting) => {
      if (project.workspace && project.relativeBaseDirectory && setting.packagePath) {
        return project.relativeBaseDirectory.startsWith(setting.packagePath)
      }

      return true
    })
    .filter((setting) => setting.devCommand)
}
