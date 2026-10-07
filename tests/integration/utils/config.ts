import type { CachedConfig } from '../../../src/lib/build.js'

type Config = CachedConfig['config']

export const createConfig = ({
  build,
  ...overrides
}: Partial<Omit<Config, 'build'>> & { build?: Partial<Config['build']> } = {}): Config => ({
  headers: [],
  images: { remote_images: [] },
  redirects: [],
  ...overrides,
  build: {
    base: '',
    environment: {},
    processing: { css: {}, html: {}, images: {}, js: {} },
    publish: '',
    publishOrigin: '',
    services: {},
    ...build,
  },
})
