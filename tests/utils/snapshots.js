const normalizers = [
  { pattern: /netlify-cli\/.+node-.+/g, value: 'netlify-cli/test-version test-os test-node-version' },
]

const normalize = (inputString) =>
  normalizers.reduce((acc, { pattern, value }) => acc.replace(pattern, value), inputString)

module.exports = { normalize }
