const process = require('process')

const test = require('ava')

const { getExecName } = require('./exec-fetcher')

test(`should postix exec with .exe on windows`, (t) => {
  const execName = 'some-binary-file'
  if (process.platform === 'win32') {
    t.is(getExecName({ execName }), `${execName}.exe`)
  } else {
    t.is(getExecName({ execName }), execName)
  }
})
