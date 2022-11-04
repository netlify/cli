// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'capitalize... Remove this comment to see the full error message
const capitalize = function (t: $TSFixMe) {
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return t.replace(/(^\w|\s\w)/g, (string: $TSFixMe) => string.toUpperCase());
}

module.exports = { capitalize }
