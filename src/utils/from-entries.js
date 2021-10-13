/**
 * @template K, V
 * @param {[K, V][]} entries
 * @returns {Record<K, V>}
 */
const fromEntries = (entries) => {
  const obj = {}
  entries.forEach(([key, value]) => {
    obj[key] = value
  })
  return obj
}

module.exports = {
  fromEntries,
}
