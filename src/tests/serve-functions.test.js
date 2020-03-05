const path = require('path')
const http = require('http')

const test = require('ava')
const getPort = require('get-port')

const sitePath = path.join(__dirname, 'dummy-site')
const { serveFunctions } = require('../utils/serve-functions')

test.before(async t => {
    // Explicitly set env var on process to simulate remote env vars
    process.env.DUMMY_VAR = 'false'

    const port = await getPort({ port: 34567 })
    const server = await serveFunctions({
        functionsDir: path.resolve(sitePath, 'functions'),
        functionsPort: port,
    })
    t.context.port = port

    return new Promise((resolve, reject) => t.context.server = server.listen(port, (err) => {
        if (err) return reject(err)
        setTimeout(resolve, 200)
    }))
})

test('envfile variable', async t => {
    const options = {
        hostname: 'localhost',
        port: t.context.port,
        path: '/env-file',
        method: 'GET'
    }

    let data = ''
    const req = http.request(options, (res) => res.on('data', (d) => data += d.toString()))

    req.on('error', error => t.log('error', error))
    req.end()

    return new Promise((resolve, reject) => req.on('close', () => {
        t.is(data, 'true')
        resolve()
    }))
})
test('undefined variable', async t => {
    const options = {
        hostname: 'localhost',
        port: t.context.port,
        path: '/no-env',
        method: 'GET'
    }

    let data = ''
    const req = http.request(options, (res) => res.on('data', (d) => data += d.toString()))

    req.on('error', error => t.log('error', error))
    req.end()

    return new Promise((resolve, reject) => req.on('close', () => {
        t.is(data, 'undefined')
        resolve()
    }))
})

test('override process env', async t => {
    let data = ''
    const options = {
        hostname: 'localhost',
        port: t.context.port,
        path: '/override-process-env',
        method: 'GET'
    }
    const req = http.request(options, (res) => res.on('data', (d) => data += d.toString()))

    req.on('error', error => t.log('error', error))
    req.end()

    req.on('close', () => {
        t.is(data, 'true')
    })

    // Verify that explicitly set env var was restored after request
    t.is(process.env.DUMMY_VAR, 'false')
})

test.after(t => {
    t.context.server.close()
})
