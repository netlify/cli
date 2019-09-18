const fs = require('fs')
const test = require('ava')
const parser = require('./line-parser')

test('simple redirects', t => {
  const source = `
  /home              /
  /blog/my-post.php  /blog/my-post # this is just an old leftover
  /blog/my-post-ads.php  /blog/my-post#ads # this is a valid anchor with a comment
  /news              /blog
`
  const result = parser.parse(source)

  console.log('Got result')

  t.deepEqual(
    [
      { path: '/home', to: '/' },
      { path: '/blog/my-post.php', to: '/blog/my-post' },
      { path: '/blog/my-post-ads.php', to: '/blog/my-post#ads' },
      { path: '/news', to: '/blog' }
    ],
    result.success
  )
})

test('redirects with status codes', t => {
  const source = `
/home         /              301
/my-redirect  /              302
/pass-through /              200
/ecommerce    /store-closed  404
`

  const result = parser.parse(source)
  t.deepEqual(
    [
      { path: '/home', to: '/', status: 301 },
      { path: '/my-redirect', to: '/', status: 302 },
      { path: '/pass-through', to: '/', status: 200 },
      { path: '/ecommerce', to: '/store-closed', status: 404 }
    ],
    result.success
  )
})

test('redirects with parameter matches', t => {
  const source = `
/      page=news      /news
/blog  post=:post_id  /blog/:post_id
/      _escaped_fragment_=/about    /about   301
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
  const source = `http://hello.bitballoon.com/* http://www.hello.com/:splat`

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
  const source = `/api/*  https://api.bitballoon.com/*   200`

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

test('redirect with country conditions', t => {
  const source = `/  /china 302 Country=ch,tw`

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/',
        to: '/china',
        status: 302,
        conditions: { Country: 'ch,tw' }
      }
    ],
    result.success
  )
})

test('redirect with country and language conditions', t => {
  const source = `/  /china 302 Country=il Language=en`

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/',
        to: '/china',
        status: 302,
        conditions: { Country: 'il', Language: 'en' }
      }
    ],
    result.success
  )
})

test('splat based redirect with no force instruction', t => {
  const source = `/*  https://www.bitballoon.com/:splat 301`

  const result = parser.parse(source)
  t.deepEqual([{ path: '/*', to: 'https://www.bitballoon.com/:splat', status: 301 }], result.success)
})

test('splat based redirect with force instruction', t => {
  const source = `/*  https://www.bitballoon.com/:splat 301!`

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/*',
        to: 'https://www.bitballoon.com/:splat',
        status: 301,
        force: true
      }
    ],
    result.success
  )
})

test('redirect rule with equal', t => {
  const source = `/test https://www.bitballoon.com/test=hello 301`

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/test',
        to: 'https://www.bitballoon.com/test=hello',
        status: 301
      }
    ],
    result.success
  )
})

test('some real world edge case rules', t => {
  const cases = [
    {
      source: `/donate source=:source email=:email /donate/usa?source=:source&email=:email 302 Country=us`,
      result: [
        {
          path: '/donate',
          to: '/donate/usa?source=:source&email=:email',
          params: { source: ':source', email: ':email' },
          status: 302,
          conditions: { Country: 'us' }
        }
      ]
    },
    {
      source: `/ https://origin.wework.com 200`,
      result: [
        {
          path: '/',
          to: 'https://origin.wework.com',
          status: 200,
          proxy: true
        }
      ]
    },
    {
      source: `/:lang/locations/* /locations/:splat 200`,
      result: [{ path: '/:lang/locations/*', to: '/locations/:splat', status: 200 }]
    }
  ]
  cases.forEach(testcase => {
    const result = parser.parse(testcase.source)
    t.deepEqual(testcase.result, result.success)
  })
})

test('rules with no destination', t => {
  const source = `/swfobject.html?detectflash=false 301`

  const result = parser.parse(source)
  t.is(0, result.success.length)
  t.is(1, result.errors.length)
})

test('rules with complext redirections', t => {
  const source = `
/google-play                https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps            301!
`

  const result = parser.parse(source)
  t.is(0, result.errors.length)
  t.is(1, result.success.length)
  t.is(
    'https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps',
    result.success[0].to
  )
})

test('complicated _redirects file', t => {
  const source = `
/10thmagnitude               http://www.10thmagnitude.com/                             301!
  /bananastand                http://eepurl.com/Lgde5            301!
  /conf                 https://docs.google.com/forms/d/1wMBXPjAcofBDqnRhKbM5KhzUbGPoxqRQZs6O_TEBa_Q/viewform?usp=send_form            301!
  /gpm                https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps            301!
  /googleplay                https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps            301!
  /google-play-music                https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps            301!
  /google                https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps            301!
  /playmusic                https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps            301!
  /google-play                https://goo.gl/app/playmusic?ibi=com.google.PlayMusic&isi=691797987&ius=googleplaymusic&link=https://play.google.com/music/m/Ihj4yege3lfmp3vs5yoopgxijpi?t%3DArrested_DevOps            301!
  /guestform  https://docs.google.com/forms/d/1zqG3fEyugSQLt-yKJNsPpgqDr0Akl8hD_z4DaGdzuOI/viewform?usp=send_form 301!
  /iphone http://itunes.apple.com/us/app/arrested-devops/id963732227 301!
  /itunes https://itunes.apple.com/us/podcast/arrested-devops/id773888088?mt=2&uo=4&at=11lsCi 301!
  /iTunes https://itunes.apple.com/us/podcast/arrested-devops/id773888088?mt=2&uo=4&at=11lsCi 301!
  /mailinglist http://eepurl.com/Lgde5 301!
  /sponsorschedule http://docs.google.com/spreadsheets/d/1wkWhmSIC_WYultwRb6jfQijrfS1x44YIyCV_pBJxgRQ/pubhtml?gid=67301010&single=true 301!
  /stackexchange http://careers.stackoverflow.com/jobs/employer/Stack%20Exchange?searchTerm=Reliability 301!
  /tenthmagnitude http://www.10thmagnitude.com/ 301!
  /xm http://www.10thmagnitude.com/ 301!
  /codeship http://www.codeship.io/arresteddevops?utm_source=arresteddevops&utm_medium=podcast&utm_campaign=ArrestedDevOpsPodcast 301!
  /datadog https://www.datadoghq.com/lpgs/?utm_source=Advertisement&utm_medium=Advertisement&utm_campaign=ArrestedDevops-Tshirt 301!
  /loggly https://www.loggly.com/?utm_source=arresteddevops&utm_medium=podcast&utm_campaign=1 301!
  /redgate http://www.red-gate.com/products/dlm/?utm_source=arresteddevops&utm_medium=displayad&utm_content=dlm&utm_campaign=dlm&utm_term=podcast-22752 301!
  /trueability http://linux.trueability.com 301!
  /hired https://hired.com/?utm_source=podcast&utm_medium=arresteddevops&utm_campaign=q2-16&utm_term=cat-tech-devops 301!
  /stickers https://www.stickermule.com/user/1070633194/stickers 301!
  /chefcommunity  https://summit.chef.io 301!
`

  const result = parser.parse(source)
  t.is(0, result.errors.length)
  t.is(26, result.success.length)
  result.success.forEach(rule => {
    t.truthy(rule.to.match(/^http/))
  })
})

test('long _redirects file', t => {
  const source = fs.readFileSync(__dirname + '/test-files/redirects', {
    encoding: 'utf-8'
  })

  const result = parser.parse(source)
  t.deepEqual([640, 734, 917, 918, 919, 920, 987], result.errors.map(e => e.lineNum))
  t.truthy(result.success.length > 0)
})

test('redirect with proxy signing', t => {
  const source = `/api/*   https://api.example.com/:splat   200!  Sign=API_SECRET`

  const result = parser.parse(source)
  t.deepEqual(
    {
      path: '/api/*',
      to: 'https://api.example.com/:splat',
      status: 200,
      force: true,
      signed: 'API_SECRET',
      proxy: true
    },
    result.success[0]
  )
})

test('absolute redirects with country condition', t => {
  const source = `
# Send all traffic from Australia to the right country URL
http://ximble.com.au/* https://www.ximble.com/au/:splat 301! Country=au
http://www.ximble.com.au/* https://www.ximble.com/au/:splat 301! Country=au
https://ximble.com.au/* https://www.ximble.com/au/:splat 301! Country=au
https://www.ximble.com.au/* https://www.ximble.com/au/:splat 301! Country=au
https://www.ximble.com/* https://www.ximble.com/au/:splat 301! Country=au

# Pages on NimbleSchedule.com that have changed
/about-us     /about
/easy-employee-scheduling/    /scheduling`

  const result = parser.parse(source)
  t.deepEqual(
    {
      host: 'ximble.com.au',
      scheme: 'http',
      path: '/*',
      to: 'https://www.ximble.com/au/:splat',
      status: 301,
      force: true,
      conditions: { Country: 'au' }
    },
    result.success[0]
  )
})

test('redirect role conditions', t => {
  const source = `/admin/*  /admin/:splat 200 Role=admin`

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/admin/*',
        to: '/admin/:splat',
        status: 200,
        conditions: { Role: 'admin' }
      }
    ],
    result.success
  )
})

test('redirect with multiple roles', t => {
  const source = `/member/*  /member/:splat 200 Role=admin,member`

  const result = parser.parse(source)
  t.deepEqual(
    [
      {
        path: '/member/*',
        to: '/member/:splat',
        status: 200,
        conditions: { Role: 'admin,member' }
      }
    ],
    result.success
  )
})

test('parse forward rule', t => {
  const source = `
/admin/* 200
/admin/* 200!`

  const result = parser.parse(source)
  t.deepEqual(
    [
      { path: '/admin/*', to: '/admin/:splat', status: 200 },
      { path: '/admin/*', to: '/admin/:splat', status: 200, force: true }
    ],
    result.success
  )
})

test('parse mistaken _headers file', t => {
  const source = `
# Protect backups with Basic Auth
/backup/*
    Basic-Auth: dev@terraeclipse.com:nud-feud-contour`

  const result = parser.parse(source)
  t.is(2, result.errors.length)
})

test('valid service destination path', t => {
  const source = `/api/* /.netlify/functions/:splat 200`

  const result = parser.parse(source)
  t.is(0, result.errors.length)
  t.is(1, result.success.length)
})
