const execa = require('execa')

const CURL_TIMEOUT = 1e5

const curl = async (url, args) => {
  const { stdout } = await execa('curl', [...args, url], { timeout: CURL_TIMEOUT })
  return stdout
}

module.exports = { curl }
