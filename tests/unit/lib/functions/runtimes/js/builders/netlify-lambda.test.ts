import { expect, test, vi } from 'vitest'

import { detectNetlifyLambda } from '../../../../../../../src/lib/functions/runtimes/js/builders/netlify-lambda.js'

test(`should not match if netlify-lambda is missing from dependencies`, async () => {
  const packageJson = {
    dependencies: {},
    devDependencies: {},
  }
  // @ts-expect-error TS(2739) FIXME: Type '{ dependencies: {}; devDependencies: {}; }' ... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { 'some-build-step': string; }; d... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { 'some-build-step': string; }; d... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { 'some-build-step': string; }; d... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { build: string; }; dependencies:... Remove this comment to see the full error message
  const match = await detectNetlifyLambda({ packageJson })

  // @ts-expect-error TS(2339) FIXME: Property 'builderName' does not exist on type 'fal... Remove this comment to see the full error message
  expect(match.builderName).toBe('netlify-lambda')
  // @ts-expect-error TS(2339) FIXME: Property 'npmScript' does not exist on type 'false... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { build: string; }; dependencies:... Remove this comment to see the full error message
  const match = await detectNetlifyLambda({ packageJson })

  // @ts-expect-error TS(2339) FIXME: Property 'builderName' does not exist on type 'fal... Remove this comment to see the full error message
  expect(match.builderName).toBe('netlify-lambda')
  // @ts-expect-error TS(2339) FIXME: Property 'npmScript' does not exist on type 'false... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { build: string; }; dependencies:... Remove this comment to see the full error message
  const match = await detectNetlifyLambda({ packageJson })

  // @ts-expect-error TS(2339) FIXME: Property 'builderName' does not exist on type 'fal... Remove this comment to see the full error message
  expect(match.builderName).toBe('netlify-lambda')
  // @ts-expect-error TS(2339) FIXME: Property 'npmScript' does not exist on type 'false... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { build: string; }; dependencies:... Remove this comment to see the full error message
  const match = await detectNetlifyLambda({ packageJson })

  // @ts-expect-error TS(2339) FIXME: Property 'builderName' does not exist on type 'fal... Remove this comment to see the full error message
  expect(match.builderName).toBe('netlify-lambda')
  // @ts-expect-error TS(2339) FIXME: Property 'npmScript' does not exist on type 'false... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { build: string; }; dependencies:... Remove this comment to see the full error message
  const match = await detectNetlifyLambda({ packageJson })

  // @ts-expect-error TS(2339) FIXME: Property 'builderName' does not exist on type 'fal... Remove this comment to see the full error message
  expect(match.builderName).toBe('netlify-lambda')
  // @ts-expect-error TS(2339) FIXME: Property 'npmScript' does not exist on type 'false... Remove this comment to see the full error message
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

  // @ts-expect-error TS(2739) FIXME: Type '{ scripts: { 'some-serve-step': string; buil... Remove this comment to see the full error message
  const match = await detectNetlifyLambda({ packageJson })

  // @ts-expect-error TS(2339) FIXME: Property 'builderName' does not exist on type 'fal... Remove this comment to see the full error message
  expect(match.builderName).toBe('netlify-lambda')
  // @ts-expect-error TS(2339) FIXME: Property 'npmScript' does not exist on type 'false... Remove this comment to see the full error message
  expect(match.npmScript).toBe('build')
})
