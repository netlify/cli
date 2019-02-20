const isEqual = require('lodash.isequal')

module.exports = function compare(oldValues, newValues) {
  const initialData = {
    // default everything is equal
    isEqual: true,
    // Keys that are different
    keys: [],
    // Values of the keys that are different
    diffs: {}
  }

  const oldKeys = Object.keys(oldValues)
  const newKeys = Object.keys(newValues)
  const set = new Set(newKeys.concat(oldKeys))

  return Array.from(set).reduce((acc, current) => {
    // if values not deep equal. There are changes
    if (!isEqual(newValues[current], oldValues[current])) {
      return {
        isEqual: false,
        keys: acc.keys.concat(current),
        diffs: Object.assign({}, acc.diffs, {
          [`${current}`]: {
            newValue: newValues[current],
            oldValue: oldValues[current]
          }
        })
      }
    }
    return acc
  }, initialData)
}
