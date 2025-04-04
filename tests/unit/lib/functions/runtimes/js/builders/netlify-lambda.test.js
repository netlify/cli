import { expect, test, vi } from 'vitest'

import { detectNetlifyLambda } from '../../../../../../../dist/lib/functions/runtimes/js/builders/netlify-lambda.js'

test(`should not match if netlify-lambda is missing from dependencies`, async () => {
  const packageJson = {
    dependencies: {},
    devDependencies: {},
  }
  expect(await detectNetlifyLambda({ packageJson })).toBe(false)
})

test('should not match if netlify-lambda is missing functions directory with argument', async () => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build --config config/webpack.config.js',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const spyConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  expect(await detectNetlifyLambda({ packageJson })).toBe(false)

  // Not checking for exact warning string as it would make this test too specific/brittle
  expect(spyConsoleWarn).toHaveBeenCalledWith(expect.stringMatching('contained no functions folder'))

  spyConsoleWarn.mockRestore()
})

test('should not match if netlify-lambda is missing functions directory', async () => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const spyConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  expect(await detectNetlifyLambda({ packageJson })).toBe(false)

  // Not checking for exact warning string as it would make this test too specific/brittle
  expect(spyConsoleWarn).toHaveBeenCalledWith(expect.stringMatching('contained no functions folder'))

  spyConsoleWarn.mockRestore()
})

test('should not match if netlify-lambda contains multiple function directories', async () => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build -config config/webpack.config.js build/dir another/build/dir',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const spyConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  expect(await detectNetlifyLambda({ packageJson })).toBe(false)

  // Not checking for exact warning string as it would make this test too specific/brittle
  expect(spyConsoleWarn).toHaveBeenCalledWith(expect.stringMatching('contained 2 or more function folders'))

  spyConsoleWarn.mockRestore()
})

test(`should match if netlify-lambda is listed in dependencies and is mentioned in scripts`, async () => {
  const packageJson = {
    scripts: {
      build: 'netlify-lambda build some/directory',
    },
    dependencies: {
      'netlify-lambda': 'ignored',
    },
    devDependencies: {},
  }

  const match = await detectNetlifyLambda({ packageJson })

  expect(match.builderName).toBe('netlify-lambda')
  expect(match.npmScript).toBe('build')
})

test(`should match if netlify-lambda is listed in devDependencies and is mentioned in scripts`, async () => {
  const packageJson = {
    scripts: {
      build: 'netlify-lambda build some/directory',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda({ packageJson })

  expect(match.builderName).toBe('netlify-lambda')
  expect(match.npmScript).toBe('build')
})

test(`should match if netlify-lambda is configured with an additional option`, async () => {
  const packageJson = {
    scripts: {
      build: 'netlify-lambda build --config config/webpack.config.js some/directory',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda({ packageJson })

  expect(match.builderName).toBe('netlify-lambda')
  expect(match.npmScript).toBe('build')
})

test(`should match if netlify-lambda is configured with multiple additional options`, async () => {
  const packageJson = {
    scripts: {
      build: 'netlify-lambda build -p 2345 --config config/webpack.config.js --static some/directory',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda({ packageJson })

  expect(match.builderName).toBe('netlify-lambda')
  expect(match.npmScript).toBe('build')
})

test('should match if netlify-lambda has options that are passed after the functions directory', async () => {
  const packageJson = {
    scripts: {
      build: 'netlify-lambda build some/directory --config config/webpack.config.js',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda({ packageJson })

  expect(match.builderName).toBe('netlify-lambda')
  expect(match.npmScript).toBe('build')
})

test('should match even if multiple netlify-lambda commands are specified', async () => {
  const packageJson = {
    scripts: {
      'some-serve-step': 'netlify-lambda serve serve/directory',
      build: 'netlify-lambda build build/directory',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda({ packageJson })

  expect(match.builderName).toBe('netlify-lambda')
  expect(match.npmScript).toBe('build')
})
