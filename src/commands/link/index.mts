// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLink... Remove this comment to see the full error message
const { createLinkCommand, link } = require('./link.cjs')

module.exports = {
  createLinkCommand,
  link,
}
