// @ts-check
const { getPathInHome } = require('../settings')

const AUTOCOMPLETION_FILE = getPathInHome(['autocompletion.json'])

module.exports = { AUTOCOMPLETION_FILE }
