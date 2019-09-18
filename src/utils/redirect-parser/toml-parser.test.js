const test = require('ava')
const parser = require('./toml-parser')

test('simple redirects', t => {
  const source = `
redirects = [
  {origin = "/home", destination = "/"},
  {origin = "/admin/*", status = 200, force = true},
  {origin = "/index", destination = "/", status = 302},
  {from = "/from", to = "/to", status = 302}
]`

  const result = parser.parse(source)
  t.deepEqual(
    [
      { path: '/home', to: '/' },
      { path: '/admin/*', to: '/admin/:splat', status: 200, force: true },
      { path: '/index', to: '/', status: 302 },
      { path: '/from', to: '/to', status: 302 }
    ],
    result.success
  )
})

test('redirects with parameter matches', t => {
  const source = `
    redirects = [
          {origin = "/", destination = "/news", parameters = {page = "news"}},
          {origin = "/blog", destination = "/blog/:post_id", parameters = {post = ":post_id"}},
          {origin = "/", destination = "/about", parameters = {_escaped_fragment_ = "/about"},  status = 301}
        ]
  `

  const result = parser.parse(source)
  t.deepEqual(
    [
      { path: '/', to: '/news', params: { page: 'news' } },
      { path: '/blog', to: '/blog/:post_id', params: { post: ':post_id' } },
      {
        path: '/',
        to: '/about',
        params: { _escaped_fragment_: '/about' },
        status: 301
      }
    ],
    result.success
  )
})

test('redirects with full hostname', t => {
  const source = `
redirects = [
  {origin = "http://hello.bitballoon.com/*", destination = "http://www.hello.com/:splat"}
]
  `

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        host: 'hello.bitballoon.com',
        scheme: 'http',
        path: '/*',
        to: 'http://www.hello.com/:splat'
      }
    ],
    result.success
  )
})

test('proxy instruction', t => {
  const source = `
  redirects = [
          {origin = "/api/*", destination = "https://api.bitballoon.com/*", status = 200}
  ]
`

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/api/*',
        to: 'https://api.bitballoon.com/*',
        status: 200,
        proxy: true
      }
    ],
    result.success
  )
})

test('headers on proxy rule', t => {
  const source = `
    redirects = [
      {origin = "/", destination = "https://api.bitballoon.com", status = 200, headers = {anything = "something"}}
    ]
  `

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/',
        to: 'https://api.bitballoon.com',
        status: 200,
        headers: { anything: 'something' },
        proxy: true
      }
    ],
    result.success
  )
})

test('redirect country conditions', t => {
  const source = `
    redirects = [
      {origin = "/", destination = "/china", status = 302, conditions = {Country = ["ch", "tw"]}},
      {origin = "/", destination = "/china", status = 302, conditions = {Country = ["il"], Language = ["en"]}}
    ]
  `

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/',
        to: '/china',
        status: 302,
        conditions: { Country: ['ch', 'tw'] }
      },
      {
        path: '/',
        to: '/china',
        status: 302,
        conditions: { Country: ['il'], Language: ['en'] }
      }
    ],
    result.success
  )
})

test('rules with no destination', t => {
  const source = `
    redirects = [
      {origin = "/swfobject.html?detectflash=false", status = 301}
    ]
  `

  const result = parser.parse(source)
  t.is(0, result.success.length)
  t.is(1, result.errors.length)
})

test('redirect role conditions', t => {
  const source = `
    redirects = [
      {origin = "/admin/*", destination = "/admin/:splat", status = 200, conditions = {Role = ["admin"]}},
      {origin = "/admin/*", destination = "/admin/:splat", status = 200, conditions = {Role = ["admin", "member"]}},
    ]
  `

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/admin/*',
        to: '/admin/:splat',
        status: 200,
        conditions: { Role: ['admin'] }
      },
      {
        path: '/admin/*',
        to: '/admin/:splat',
        status: 200,
        conditions: { Role: ['admin', 'member'] }
      }
    ],
    result.success
  )
})

test('invalid headers on proxy rule', t => {
  const source = `
    redirects = [
      {origin = "/", destination = "https://api.bitballoon.com", status = 200, headers = [{anything = "something"}]}
    ]
  `

  const result = parser.parse(source)
  t.is(0, result.success.length)
  t.is(1, result.errors.length)
})

test('missing origin in redirect rule', t => {
  const source = `
    redirects = [
      {destination = "/index.html", status = 200}
    ]
  `

  const result = parser.parse(source)
  t.is(0, result.success.length)
  t.is(1, result.errors.length)
})

test('invalid netlify service source path', t => {
  const source = `
    redirects = [
      {origin = "/.netlify/lfs", destination = "https://pawned.com"},
      {origin = "https://example.com/.netlify/lfs", destination = "https://pawned.com"}
    ]
  `

  const result = parser.parse(source)
  t.is(0, result.success.length)
  t.is(2, result.errors.length)
  result.errors.forEach(err => {
    t.is('Invalid /.netlify path in redirect source', err.reason)
  })
})

test('valid netlify service destination path', t => {
  const source = `
    redirects = [
      {origin = "/api/*", destination = "/.netlify/function/:splat"},
    ]
  `

  const result = parser.parse(source)
  t.is(0, result.errors.length)
  t.is(1, result.success.length)
})
