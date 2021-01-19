const test = require('ava')

const { detectNetlifyLambda } = require('../netlify-lambda')

test(`should not find netlify-lambda from netlify-cli package.json`, async (t) => {
  t.is(await detectNetlifyLambda(), false)
})

test(`should not match if netlify-lambda is missing from dependencies`, async (t) => {
  const packageJson = {
    dependencies: {},
    devDependencies: {},
  }
  t.is(await detectNetlifyLambda(packageJson), false)
})

test(`should match if netlify-lambda is listed in dependencies and is mentioned in scripts`, async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build some/directory',
    },
    dependencies: {
      'netlify-lambda': 'ignored',
    },
    devDependencies: {},
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'some/directory')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})

test(`should match if netlify-lambda is listed in devDependencies and is mentioned in scripts`, async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build some/directory',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'some/directory')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})

test(`should not match if netlify-lambda misses function directory`, async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, true)
})

test(`should match if netlify-lambda is configured with an additional option`, async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build --config config/webpack.config.js some/directory',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'some/directory')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})

test(`should match if netlify-lambda is configured with multiple additional options`, async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build -s --another-option --config config/webpack.config.js some/directory',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'some/directory')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})

test("should match if netlify-lambda has options that are passed after the functions directory", async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build some/directory --config config/webpack.config.js'
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored'
    },
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'some/directory')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})

test("should match even if multiple netlify-lambda commands are specified", async (t) =>  {
  const packageJson = {
    scripts: {
      'some-serve-step': 'netlify-lambda serve serve/directory',
      'some-build-step': 'netlify-lambda build build/directory'
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored'
    }
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'build/directory')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})

