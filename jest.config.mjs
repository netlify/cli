/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  testEnvironment: 'node',
  verbose: true,
  // testTimeout: 6_000,
  testMatch: ['**/*.test.{js,mjs}'],
  moduleFileExtensions: ['js', 'mjs'],
  collectCoverageFrom: ['**/*.{mjs,js,cjs}', '!**/node_modules/**'],
}

export default config
