const normalizers = [
  { pattern: /netlify-cli\/.+node-.+/g, value: 'netlify-cli/test-version test-os test-node-version' },
<<<<<<< HEAD
  // normalize random ports
  { pattern: /\d{5}/g, value: '88888' },
  // windows specific
  { pattern: /\\/gu, value: '/' },
  { pattern: /\r\n/gu, value: '\n' },
  { pattern: /❯/gu, value: '>' },
  // normalize exit code from different OSes
  { pattern: /code \d+/, value: 'code *' },
  // this is specific to npm v6
  { pattern: /@ start.+\/.+netlify-cli-tests-v10.+/, value: 'start' },
=======
  { pattern: /\d{5}/g, value: '88888' },
>>>>>>> 168bc68a (test(frameworks): replace unit tests with integration tests)
]

const normalize = (inputString) =>
  normalizers.reduce((acc, { pattern, value }) => acc.replace(pattern, value), inputString)

module.exports = { normalize }
