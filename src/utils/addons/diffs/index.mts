// @ts-check
const concordance = require('concordance')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'concordanc... Remove this comment to see the full error message
const { concordanceDiffOptions, concordanceOptions } = require('./options.cjs')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const formatDescriptorDiff = function (actualDescriptor: $TSFixMe, expectedDescriptor: $TSFixMe, options: $TSFixMe) {
  const diffOptions = { ...options, ...concordanceDiffOptions }
  return concordance.diffDescriptors(actualDescriptor, expectedDescriptor, diffOptions)
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
module.exports = function diffValues(actual: $TSFixMe, expected: $TSFixMe) {
  const result = concordance.compare(actual, expected, concordanceOptions)
  if (result.pass) {
    return null
  }
  const actualDescriptor = result.actual || concordance.describe(actual, concordanceOptions)
  const expectedDescriptor = result.expected || concordance.describe(expected, concordanceOptions)

  // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
  return formatDescriptorDiff(actualDescriptor, expectedDescriptor)
}
