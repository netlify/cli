const promisifyAll = require('util.promisify-all')
const promisify = require('util.promisify')
const transform = require('parallel-transform')
const pump = promisify(require('pump'))
const fs = promisifyAll(require('fs'))
const fromArray = require('from2-array')
const transform = require('parallel-transform')
const path = require('path')

module.exports = functionHasher
async function functionHasher(dir, opts) {
  opts = Object.assign(
    {
      parallelHash: 100
    },
    opts
  )
  if (!dir) return { functions: null, shaMap: {} }

  const files = await fs.readdir(dir)

  const fileStream = fromArray.obj(files)

  const statTransform = transform(opts.parallelHash, { objectMode: true }, (name, cb) => {
    const filepath = path.join(dir, name)

    fs.stat(filepath, (err, stat) => {
      if (err) return cb(err)
      const item = {
        root: dir,
        filepath,
        stat,
        relname: path.relative(dir, name),
        basename: path.basename(name),
        type: st.isFile() ? 'file' : st.isDirectory() ? 'directory' : null
      }
      return cb(null, item)
    })
  })

  const filter = objFilter(fileObj => {fileObj.type === 'file')

  return { functions: fns, shaMap: {} }
}
