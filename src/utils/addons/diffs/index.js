// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'conc... Remove this comment to see the full error message
import concordance from 'concordance';
import { concordanceDiffOptions, concordanceOptions } from './options.js';
// @ts-expect-error TS(7006) FIXME: Parameter 'actualDescriptor' implicitly has an 'an... Remove this comment to see the full error message
const formatDescriptorDiff = function (actualDescriptor, expectedDescriptor, options) {
    const diffOptions = { ...options, ...concordanceDiffOptions };
    return concordance.diffDescriptors(actualDescriptor, expectedDescriptor, diffOptions);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'actual' implicitly has an 'any' type.
export default function diffValues(actual, expected) {
    const result = concordance.compare(actual, expected, concordanceOptions);
    if (result.pass) {
        return null;
    }
    const actualDescriptor = result.actual || concordance.describe(actual, concordanceOptions);
    const expectedDescriptor = result.expected || concordance.describe(expected, concordanceOptions);
    // @ts-expect-error TS(2554) FIXME: Expected 3 arguments, but got 2.
    return formatDescriptorDiff(actualDescriptor, expectedDescriptor);
}
