const fs = require('fs')

const TOKEN_COMMENT = "#"
const TOKEN_PATH = "/"

function parseHeadersFile(filePath) {
    const headers = {}
    if (!fs.existsSync(filePath)) return headers
    if (fs.statSync(filePath).isDirectory()) {
        console.warn('expected _headers file but found a directory at:', filePath)
        return headers
    }

    const lines  = fs.readFileSync(filePath, { encoding: 'utf8' }).split('\n')
    if (lines.length < 1) return headers

    let path
    for (let i = 0; i <= lines.length; i++) {
        if (!lines[i]) continue

        const line = lines[i].trim()

        if (line.startsWith(TOKEN_COMMENT) || line.length < 1) continue
        if (line.startsWith(TOKEN_PATH)) {
            path = line
            continue
        }

        if (line.includes(':')) {
            const sepIndex = line.indexOf(':')
            if (sepIndex < 1) throw new Error(`invalid header at line: ${i}\n${line}\n`)

            const key = line.substr(0, sepIndex)
            const value = line.substr(sepIndex + 1).trim()

            if (headers.hasOwnProperty(path)) {
                if (headers[path].hasOwnProperty(key)) {
                    headers[path][key].push(value)
                } else {
                    headers[path][key] = [value]
                }
            } else {
                headers[path] = {[key]: [value]}
            }
        }
    }

    return headers
}

module.exports = parseHeadersFile
