// @ts-check
const deploy = require('./deploy')
const proxy = require('./proxy')

module.exports = { ...deploy, ...proxy }
