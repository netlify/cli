const test = require('ava')

const callCli = require('../../utils/call-cli.cjs')
const { normalize } = require('../../utils/snapshots.cjs')

test('suggests closest matching command on typo', async (t) => {
  // failures are expected since we effectively quit out of the prompts
  const errors = await Promise.all([
    t.throwsAsync(() => callCli(['sta'])),
    t.throwsAsync(() => callCli(['opeen'])),
    t.throwsAsync(() => callCli(['hel'])),
    t.throwsAsync(() => callCli(['versio'])),
  ])
  errors.forEach((error) => {
    t.snapshot(normalize(error.stdout, { duration: true, filePath: true }))
  })
})
