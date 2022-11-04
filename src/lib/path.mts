// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'normalizeB... Remove this comment to see the full error message
const normalizeBackslash = (path: $TSFixMe) => path.replace(/\\/g, '/')

module.exports = { normalizeBackslash }
