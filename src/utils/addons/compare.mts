import {isEqual} from 'lodash'


module.exports = function compare(oldValues: $TSFixMe, newValues: $TSFixMe) {
  const initialData = {
    // default everything is equal
    isEqual: true,
    // Keys that are different
    keys: [],
    // Values of the keys that are different
    diffs: {},
  }

  const oldKeys = Object.keys(oldValues)
  const newKeys = Object.keys(newValues)
  const set = new Set([...newKeys, ...oldKeys])

  // @ts-expect-error TS(2769): No overload matches this call.
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
      }
    }
    return acc
  }, initialData)
}
