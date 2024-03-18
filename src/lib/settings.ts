import os from 'os'
import path from 'path'

import envPaths from 'env-paths'

const OSBasedPaths = envPaths('netlify', { suffix: '' })
const NETLIFY_HOME = '.netlify'

/**
 * Deprecated method to get netlify's home config - ~/.netlify/...
 * @deprecated
 */
export const getLegacyPathInHome = (paths: string[]) => path.join(os.homedir(), NETLIFY_HOME, ...paths)

/**
 * get a global path on the os base path
 */
export const getPathInHome = (paths: string[]) => path.join(OSBasedPaths.config, ...paths)

/**
 * get a path inside the project folder "NOT WORKSPACE AWARE"
 */
export const getPathInProject = (paths: string[]) => path.join(NETLIFY_HOME, ...paths)
