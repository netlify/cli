import test from 'ava'
import { fileHasher } from '.'

test('hashes files in a folder', async t => {
  let progressFired = false

  const { manifest, shaMap } = await fileHasher(__dirname, {
    onProgress: progress => {
      progressFired = true
      t.truthy(progress.total, 'progress has a total field')
      t.truthy(progress.current, 'progress has a current field')
    }
  })
  t.true(progressFired, 'Progress callback fired')

  Object.keys(manifest).forEach(path => t.true(path.startsWith('/'), 'paths use unix sep'))
  t.truthy(shaMap, 'shaMap is returned')
})
