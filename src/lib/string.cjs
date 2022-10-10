const capitalize = function (t) {
  return t.replace(/(^\w|\s\w)/g, (string) => string.toUpperCase())
}

module.exports = { capitalize }
