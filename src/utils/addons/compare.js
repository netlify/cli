import isEqual from 'lodash/isEqual.js';
// @ts-expect-error TS(7006) FIXME: Parameter 'oldValues' implicitly has an 'any' type... Remove this comment to see the full error message
export default function compare(oldValues, newValues) {
    const initialData = {
        // default everything is equal
        isEqual: true,
        // Keys that are different
        keys: [],
        // Values of the keys that are different
        diffs: {},
    };
    const oldKeys = Object.keys(oldValues);
    const newKeys = Object.keys(newValues);
    const set = new Set([...newKeys, ...oldKeys]);
    // @ts-expect-error TS(2769) FIXME: No overload matches this call.
    return [...set].reduce((acc, current) => {
        // if values not deep equal. There are changes
        if (!isEqual(newValues[current], oldValues[current])) {
            return {
                isEqual: false,
                keys: [...acc.keys, current],
                diffs: {
                    ...acc.diffs,
                    [`${current}`]: {
                        newValue: newValues[current],
                        oldValue: oldValues[current],
                    },
                },
            };
        }
        return acc;
    }, initialData);
}
