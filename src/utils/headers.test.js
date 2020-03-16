const test = require('ava')
const path = require('path')
const parseHeadersFile  = require('./headers.js')

test('_headers: validate correct parsing', t => {
    const sitePath = path.join(__dirname, '../tests/dummy-site')
    const rules = parseHeadersFile(path.resolve(sitePath, '_headers'))

    t.deepEqual(rules, {
        "/": {
            "X-Frame-Options": [
                "SAMEORIGIN",
                "DENY"
            ],
            "X-XSS-Protection": [
                "1; mode=block"
            ],
            "cache-control": [
                "max-age=0",
                "no-cache",
                "no-store",
                "must-revalidate"
            ]
        },
        "/templates/index2.html": {
            "X-Frame-Options": [
                "SAMEORIGIN"
            ]
        }
    })
})
