const lineParser = require('./line-parser')
const tomlParser = require('./toml-parser')

exports.parseRedirectsFormat = lineParser.parse
exports.parseTomlFormat = tomlParser.parse
