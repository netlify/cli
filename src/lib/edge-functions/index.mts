// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'constants'... Remove this comment to see the full error message
const constants = require('./consts.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'deploy'.
const deploy = require('./deploy.cjs')
const editorHelper = require('./editor-helper.cjs')
const proxy = require('./proxy.cjs')

module.exports = { ...constants, ...deploy, ...editorHelper, ...proxy }
