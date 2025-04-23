// TODO(ndhoule): Remove this file and point former consumers at './global-config/main.js'
import { getGlobalConfigStore } from './global-config/main.js'

export default getGlobalConfigStore

export { type GlobalConfigStore, getGlobalConfigStore, resetConfigCache } from './global-config/main.js'
