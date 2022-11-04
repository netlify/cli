// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphCommand } = require('./graph.cjs')

module.exports = {
  createGraphCommand,
}
