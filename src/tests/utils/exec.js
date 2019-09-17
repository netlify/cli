const { exec } = require('child_process')

module.exports = (cmd, opts) =>
  new Promise((resolve, reject) => {
    const dirOutput = opts && opts.cwd ? `\nDIR: ${opts.cwd}` : ''
    console.log(`Running command...\nCMD: ${cmd}${dirOutput}`)
    exec(cmd, opts, (err, stdout, stderr) => {
      if (err) {
        return reject(err)
      }
      return resolve({ stdout, stderr })
    })
  })
