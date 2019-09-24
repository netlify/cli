const test = require('ava')
const findRoot = require('.')
const path = require('path')
const tempy = require('tempy')
const mkdirp = require('mkdirp')

test('Find root in a git project', t => {
  // can't check in .git folders so we just make one as part of the test
  mkdirp.sync(path.join(__dirname, 'fixtures', 'git-project', '.git'))
  t.is(
    findRoot(path.join(__dirname, 'fixtures', 'git-project', 'some', 'sub', 'dir')),
    path.join(__dirname, 'fixtures', 'git-project'),
    'Correct project dir with git directory'
  )
})

test('Find root in a linked folder', t => {
  t.is(
    findRoot(path.join(__dirname, 'fixtures', 'state-folder', 'some', 'sub', 'dir')),
    path.join(__dirname, 'fixtures', 'state-folder'),
    'Correct project dir with a .netlify folder in it'
  )
})

test('Find root in a netlify site folder', t => {
  t.is(
    findRoot(path.join(__dirname, 'fixtures', 'toml-config', 'some', 'sub', 'dir')),
    path.join(__dirname, 'fixtures', 'toml-config'),
    'Defaults to folder with a toml file in it'
  )
})

test('Find root with no indicators', t => {
  const tmp = tempy.directory()
  const subPath = path.join(tmp, 'some', 'sub', 'dir')
  mkdirp.sync(subPath)
  t.is(findRoot(subPath), subPath, 'CWD if no indicators are located')
})
