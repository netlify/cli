const http = require('http')

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname

  console.log(`Got ${pathname}`)

  if (pathname === '/') {
    res.write('Root page')
    res.end()
  } else if (pathname === '/test/exists') {
    res.writeHead(302, undefined, { location: '/test/exists/' })
    res.end()
  } else if (pathname === '/test/exists/') {
    res.write('Test exists page')
    res.end()
  } else if (pathname === '/test/not-allowed') {
    res.writeHead(405)
    res.write('This not allowed')
    res.end()
  } else {
    res.writeHead(404).write('Page is not found')
    res.end()
  }
})

server.listen(6124, () => {
  console.log('Server is Running')
})
