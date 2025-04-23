import { GlobalConfigStore } from './store.js'

export { type GlobalConfigStore } from './store.js'

// Memoise config result so that we only load it once
let configStore: GlobalConfigStore | undefined

export const getGlobalConfigStore = async (): Promise<GlobalConfigStore> => {
  if (!configStore) {
    configStore = new GlobalConfigStore()
  }
  return Promise.resolve(configStore)
}

export const resetConfigCache = () => {
  configStore = undefined
}
