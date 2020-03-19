const fs = require('fs')

const TOKEN_COMMENT = "#"
const TOKEN_PATH = "/"

function parseHeadersFile(filePath) {
    const rules = {}
    if (!fs.existsSync(filePath)) return rules
    if (fs.statSync(filePath).isDirectory()) {
        console.warn('expected _headers file but found a directory at:', filePath)
        return rules
    }

    const lines  = fs.readFileSync(filePath, { encoding: 'utf8' }).split('\n')
    if (lines.length < 1) return rules

    let path
    for (let i = 0; i <= lines.length; i++) {
        if (!lines[i]) continue

        const line = lines[i].trim()

        if (line.startsWith(TOKEN_COMMENT) || line.length < 1) continue
        if (line.startsWith(TOKEN_PATH)) {
            if (line.includes('*') && line.indexOf('*') !== line.length - 1) {
                throw new Error(`invalid rule (A path rule cannot contain anything after * token) at line: ${i}\n${lines[i]}\n`)
            }
            path = line
            continue
        }

        if (line.includes(':')) {
            const sepIndex = line.indexOf(':')
            if (sepIndex < 1) throw new Error(`invalid header at line: ${i}\n${lines[i]}\n`)

            const key = line.substr(0, sepIndex).trim()
            const value = line.substr(sepIndex + 1).trim()

            if (rules.hasOwnProperty(path)) {
                if (rules[path].hasOwnProperty(key)) {
                    rules[path][key].push(value)
                } else {
                    rules[path][key] = [value]
                }
            } else {
                rules[path] = {[key]: [value]}
            }
        }
    }

    return rules
}

module.exports = parseHeadersFile
