const normalizers = [
  { pattern: /netlify-cli\/.+node-.+/g, value: 'netlify-cli/test-version test-os test-node-version' },
  // normalize random ports
  { pattern: /\d{5}/g, value: '88888' },
  // windows specific
  { pattern: /\\/gu, value: '/' },
  { pattern: /\r\n/gu, value: '\n' },
  { pattern: /❯/gu, value: '>' },
  // normalize exit code from different OSes
  { pattern: /code \d+/, value: 'code *' },
  // this is specific to npm v6
  { pattern: /@ (\w+).+\/.+netlify-cli-tests-v[\d{2}].+/, value: '$1' },
  { pattern: /It should be one of.+/gm, value: 'It should be one of: *' },
  // remove extra '.'s resulting from different load times that lead to flaky snapshots,
  { pattern: /\.+(?=\.)/, value: '' },
]

const normalize = (inputString) =>
  normalizers.reduce((acc, { pattern, value }) => acc.replace(pattern, value), inputString)

module.exports = { normalize }
