const sinon = require('sinon')

const { detectNetlifyLambda } = require('../netlify-lambda')

test(`should not find netlify-lambda from netlify-cli package.json`, async () => {
  expect(await detectNetlifyLambda()).toBe(false)
})

test(`should not match if netlify-lambda is missing from dependencies`, async () => {
  const packageJson = {
    dependencies: {},
    devDependencies: {},
  }
  expect(await detectNetlifyLambda({ packageJson })).toBe(false)
})

test('should not match if netlify-lambda is missing functions directory', async () => {
  const sandbox = sinon.createSandbox()

  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build --config config/webpack.config.js',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const spyConsoleWarn = sandbox.spy(console, 'warn')

  expect(await detectNetlifyLambda({ packageJson })).toBe(false)

  // Not checking for exact warning string as it would make this test too specific/brittle
  expect(spyConsoleWarn.calledWithMatch('contained no functions folder')).toBe(true)

  sandbox.restore()
})

test('should not match if netlify-lambda contains multiple function directories', async () => {
  const sandbox = sinon.createSandbox()

  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build -config config/webpack.config.js build/dir another/build/dir',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const spyConsoleWarn = sandbox.spy(console, 'warn')

  expect(await detectNetlifyLambda({ packageJson })).toBe(false)

  // Not checking for exact warning string as it would make this test too specific/brittle
  expect(spyConsoleWarn.calledWithMatch('contained 2 or more function folders')).toBe(true)

  sandbox.restore()
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

test(`should not match if netlify-lambda misses function directory`, async () => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda({ packageJson })
  expect(match).toBe(false)
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
      build: 'netlify-lambda build -s --another-option --config config/webpack.config.js some/directory',
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
