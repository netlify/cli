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

const packages = ['live-tunnel-client']

packages.forEach(packageName => {
  test(`${packageName} - should postix exec with .exe on windows`, t => {
    if (process.platform === 'win32') {
      t.is(getExecName({ packageName }), `${packageName}.exe`)
    } else {
      t.is(getExecName({ packageName }), packageName)
    }
  })

  test(`${packageName} - should return true on empty directory`, async t => {
    const { binPath } = t.context
    const actual = await shouldFetchLatestVersion({ binPath, packageName })
    t.is(actual, true)
  })

  test(`${packageName} - should return false after latest version is fetched`, async t => {
    const { binPath } = t.context

    await fetchLatestVersion({ packageName, destination: binPath })

    const actual = await shouldFetchLatestVersion({ binPath, packageName })
    t.is(actual, false)
  })

  test(`${packageName} - should download latest version on empty directory`, async t => {
    const { binPath } = t.context

    await fetchLatestVersion({ packageName, destination: binPath })

    const execPath = path.join(binPath, getExecName({ packageName }))
    const stats = await fs.stat(execPath)
    t.is(stats.size >= 5000, true)
  })
})

test.afterEach(async t => {
  await fs.remove(t.context.binPath)
})
