const config = {
  files: ['e2e/**/*.e2e.mjs'],
  cache: true,
  // eslint-disable-next-line no-magic-numbers
  concurrency: 5,
  failFast: false,
  failWithoutAssertions: false,
  tap: false,
  timeout: '10m',
}

export default config
