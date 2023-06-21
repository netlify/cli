// @ts-check
import { Project } from '@netlify/build-info'
// eslint-disable-next-line import/extensions, n/no-missing-import
import { NodeFS } from '@netlify/build-info/node'

/**
 * @param {{ baseDirectory: string }} param0
 * @returns
 */
export const getFrameworkInfo = async ({ baseDirectory }) => {
  const fs = new NodeFS()
  const project = new Project(fs, baseDirectory)
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
