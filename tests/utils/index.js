
function randomPort(){
  return '2'+Math.random().toString().substr(2, 4)
}

module.exports = {
  randomPort: randomPort,
}
