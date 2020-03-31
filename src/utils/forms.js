const FORM_URLENCODED = 'application/x-www-form-urlencoded'

function collectRequestBody(request, callback) {
    let body = ''

    request.on('data', chunk => body += chunk)

    if(request.headers['content-type'] === FORM_URLENCODED) {
        request.on('end', () => callback(body))
    }  else {
        callback(body)
    }
}

module.exports = {
    collectRequestBody,
}
