// @ts-check
const concordance = require('concordance')


const { concordanceDiffOptions, concordanceOptions } = require('./options.cjs')


const formatDescriptorDiff = function (actualDescriptor: $TSFixMe, expectedDescriptor: $TSFixMe, options: $TSFixMe) {
  const diffOptions = { ...options, ...concordanceDiffOptions }
  return concordance.diffDescriptors(actualDescriptor, expectedDescriptor, diffOptions)
}


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
