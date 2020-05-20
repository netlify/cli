function randomPort() {
  const min = Math.ceil(2000)
  const max = Math.floor(7999)
  return (Math.floor(Math.random() * (max - min + 1)) + min).toString()
}

module.exports = {
  randomPort: randomPort,
}
