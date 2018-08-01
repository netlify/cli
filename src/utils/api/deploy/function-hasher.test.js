const test = require('ava')
const fnHasher = require('./function-hasher')

test('hashes functions in a folder', async t => {
  const { files, shaMap } = await fnHasher(__dirname)
  t.deepEqual(files, [])
  t.deepEqual(shaMap, {})
})
