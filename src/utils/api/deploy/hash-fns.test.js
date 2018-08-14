const test = require('ava')
const hashFns = require('./hash-fns')

test('hashes functions in a folder', async t => {
  const { files, shaMap } = await hashFns(__dirname)
  t.deepEqual(files, [])
  t.deepEqual(shaMap, {})
})
