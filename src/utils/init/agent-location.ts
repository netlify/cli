import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const realpathOrSelf = async (target: string): Promise<string> => {
  try {
    return await fs.realpath(target)
  } catch {
    return path.resolve(target)
  }
}

export interface ProjectSetupBlocker {
  place: 'home' | 'root'
  reason: string
}

export const findProjectSetupBlocker = async (
  root: string,
  home: string = homedir(),
): Promise<ProjectSetupBlocker | undefined> => {
  const resolvedRoot = await realpathOrSelf(root)
  if (resolvedRoot === (await realpathOrSelf(home))) {
    return { place: 'home', reason: 'this is your home directory, where they would apply to every project' }
  }
  if (resolvedRoot === path.parse(resolvedRoot).root) {
    return { place: 'root', reason: 'this is the root of the file system' }
  }
  return undefined
}
