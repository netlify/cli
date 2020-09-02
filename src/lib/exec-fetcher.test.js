const test = require('ava')
const path = require('path')
const fs = require('fs-extra')
const tempDirectory = require('temp-dir')
const { v4: uuid } = require('uuid')
const { getExecName, shouldFetchLatestVersion, fetchLatestVersion } = require('./exec-fetcher')

test.beforeEach(t => {
  const directory = path.join(tempDirectory, `netlify-cli-exec-fetcher`, uuid())
  t.context.binPath = directory
})

test(`should postix exec with .exe on windows`, t => {
  const execName = 'some-binary-file'
  if (process.platform === 'win32') {
    t.is(getExecName({ execName }), `${execName}.exe`)
  } else {
    t.is(getExecName({ execName }), execName)
  }
})

const packages = [
  // Disabled since failing on CI due to GitHub API limits when fetching releases
  // TODO: Re-enabled when we can think of a solution
  // {
  //   packageName: 'traffic-mesh-agent',
  //   execName: 'traffic-mesh',
  //   execArgs: ['--version'],
  //   pattern: '\\sv(.+)',
  //   extension: 'zip',
  // },
]

packages.forEach(({ packageName, execName, execArgs, pattern, extension }) => {
  const log = console.log

  test(`${packageName} - should return true on empty directory`, async t => {
    const { binPath } = t.context
    const actual = await shouldFetchLatestVersion({ binPath, packageName, execName, execArgs, pattern, log })
    t.is(actual, true)
  })

  test(`${packageName} - should return false after latest version is fetched`, async t => {
    const { binPath } = t.context

    await fetchLatestVersion({ packageName, execName, destination: binPath, extension })

    const actual = await shouldFetchLatestVersion({ binPath, packageName, execName, execArgs, pattern, log })
    t.is(actual, false)
  })

  test(`${packageName} - should download latest version on empty directory`, async t => {
    const { binPath } = t.context

    await fetchLatestVersion({ packageName, execName, destination: binPath, extension })

    const execPath = path.join(binPath, getExecName({ execName }))
    const stats = await fs.stat(execPath)
    t.is(stats.size >= 5000, true)
  })
})

test.afterEach(async t => {
  await fs.remove(t.context.binPath)
})
