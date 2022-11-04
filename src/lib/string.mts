
const capitalize = function (t: $TSFixMe) {
  
  return t.replace(/(^\w|\s\w)/g, (string: $TSFixMe) => string.toUpperCase());
}

module.exports = { capitalize }
