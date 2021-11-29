const cookie = require('cookie')

// 14 days
const COOKIE_MAX_AGE = 12096e5

const handler = async () => {
  const myCookie = cookie.serialize('my_cookie', 'lolHi', {
    secure: true,
    httpOnly: true,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })

  const redirectUrl = 'https://google.com'
  // Do redirects via html
  const html = `
  <html lang="en">
    <head>
      <meta charset="utf-8">
    </head>
    <body>
      <noscript>
        <meta http-equiv="refresh" content="0; url=${redirectUrl}" />
      </noscript>
    </body>
    <script>
      setTimeout(function(){
        window.location.href = ${JSON.stringify(redirectUrl)}
      }, 0)
    </script>
  </html>`

  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': myCookie,
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/html',
    },
    body: html,
  }
}

module.exports = { handler }
