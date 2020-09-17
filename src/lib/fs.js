const fs = require('fs')
const { promisify } = require('util')

const statAsync = promisify(fs.stat)
const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const accessAsync = promisify(fs.access)

const readFileAsyncCatchError = filepath => {
  return readFileAsync(filepath)
    .then(content => ({ content }))
    .catch(error => ({ error }))
}

module.exports = { statAsync, readFileAsync, readFileAsyncCatchError, writeFileAsync, accessAsync }
