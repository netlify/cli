import { join } from 'path'

import { getPathInProject } from '../settings.js'
import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from './consts.js'
import BaseCommand from '../../commands/base-command.js'
import { fileExistsAsync } from '../fs.js'

export const getUserEdgeFunctionsDirectory = (command: BaseCommand): string | undefined => {
  return command.netlify.config.build.edge_functions
}

export const getInternalEdgeFunctionsDirectory = (command: BaseCommand): string => {
  return join(command.workingDir, getPathInProject([INTERNAL_EDGE_FUNCTIONS_FOLDER]))
}

export const getFrameworkEdgeFunctionsDirectory = (command: BaseCommand): string => {
  return command.netlify.frameworksAPIPaths.edgeFunctions.path
}

const getAllEdgeFunctionsDirectories = (command: BaseCommand) => {
  return [
    getUserEdgeFunctionsDirectory(command),
    getInternalEdgeFunctionsDirectory(command),
    getFrameworkEdgeFunctionsDirectory(command),
  ].filter(Boolean) as string[]
}

export const anyEdgeFunctionsDirectoryExists = async (command: BaseCommand): Promise<boolean> => {
  const directoriesToCheck = getAllEdgeFunctionsDirectories(command)

  return (await Promise.all(directoriesToCheck.map(fileExistsAsync))).some(Boolean)
}
