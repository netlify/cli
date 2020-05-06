const test = require('ava')
const path = require('path')
const { getFunctions } = require('./get-functions.js')
const { findModuleDir } = require('./finders')
const sitePath = path.join(__dirname, '..', '..', 'tests', 'dummy-site')

test('pass empty string', t => {
  const f = getFunctions('')
  t.deepEqual(f, {})
})

test('pass directory with no *.js files', t => {
  const f = getFunctions(sitePath)
  t.deepEqual(f, {})
})

test('pass dummy repository with *.js files', t => {
  const sitePath = path.join(__dirname, '..', '..', 'tests', 'dummy-repo')
  const f = getFunctions(sitePath)
  t.deepEqual(f, {
    index: {
      functionPath: path.join(sitePath, 'index.js'),
      moduleDir: findModuleDir(sitePath)
    }
  })
})
