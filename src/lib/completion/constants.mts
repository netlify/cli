// @ts-check
const { getPathInHome } = require('../settings.cjs')

const AUTOCOMPLETION_FILE = getPathInHome(['autocompletion.json'])

module.exports = { AUTOCOMPLETION_FILE }
