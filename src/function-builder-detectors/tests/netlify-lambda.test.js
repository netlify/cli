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

// Note that this is less than ideal, but I preferred to keep it simple and not actually parse the arguments with a library
test(`should use the value of the parameter if no directory was provided`, async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step': 'netlify-lambda build -s --another-option --config config/webpack.config.js',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'config/webpack.config.js')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})

// Again, less than ideal, but it seems impossible to have @oclif/parser to parse a complete string instead of argv[]
test(`should ignore spaces in the directory name`, async (t) => {
  const packageJson = {
    scripts: {
      'some-build-step':
        'netlify-lambda build -s --another-option --config config/webpack.config.js some directory/name',
    },
    dependencies: {},
    devDependencies: {
      'netlify-lambda': 'ignored',
    },
  }

  const match = await detectNetlifyLambda(packageJson)
  t.not(match, false)

  t.is(match.src, 'directory/name')
  t.is(match.builderName, 'netlify-lambda')
  t.is(match.npmScript, 'some-build-step')
})
