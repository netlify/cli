// @ts-check
const constants = require('./consts.cjs')
const deploy = require('./deploy.cjs')
const proxy = require('./proxy.cjs')

module.exports = { ...constants, ...deploy, ...proxy }
