import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const PROJECT_MARKERS = ['.git', 'package.json', 'netlify.toml'] as const

const realpathOrSelf = async (target: string): Promise<string> => {
  try {
    return await fs.realpath(target)
  } catch {
    return path.resolve(target)
  }
}

const exists = async (target: string): Promise<boolean> => {
  try {
    await fs.lstat(target)
    return true
  } catch {
    return false
  }
}

export const findAgentSetupBlocker = async (root: string, home: string = homedir()): Promise<string | undefined> => {
  const resolvedRoot = await realpathOrSelf(root)
  if (resolvedRoot === (await realpathOrSelf(home))) {
    return 'this is your home directory, where agent folders hold settings for every project'
  }
  for (const marker of PROJECT_MARKERS) {
    if (await exists(path.join(resolvedRoot, marker))) {
      return undefined
    }
  }
  return `no ${PROJECT_MARKERS.join(', ')} found in ${resolvedRoot}`
}
