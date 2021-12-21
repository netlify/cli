// @ts-check
const deploySite = require('./deploy-site')
const uploadFiles = require('./upload-files')
const util = require('./util')

module.exports = { ...deploySite, ...uploadFiles, ...util }
