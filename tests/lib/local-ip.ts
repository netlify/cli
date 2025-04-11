import process from 'process'

// @ts-expect-error TS(1192) FIXME: Module '"/home/ndhoule/dev/src/github.com/netlify/... Remove this comment to see the full error message
import semver from 'semver'

const version = process.version.slice(1)

// This changed in Node 17 with https://github.com/nodejs/node/pull/39987.
const [clientIP, originalIP] = semver.gte(version, '17.0.0') ? ['::1', '::1'] : ['127.0.0.1', '::ffff:127.0.0.1']

export { clientIP, originalIP }
