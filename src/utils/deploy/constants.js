// Local deploy timeout: 20 mins
const DEFAULT_DEPLOY_TIMEOUT = 1.2e6
// Concurrent file hash calls
const DEFAULT_CONCURRENT_HASH = 1e2
// Number of concurrent uploads
const DEFAULT_CONCURRENT_UPLOAD = 5
// Number of files
const DEFAULT_SYNC_LIMIT = 1e2
// Number of times to retry an upload
const DEFAULT_MAX_RETRY = 5

const UPLOAD_RANDOM_FACTOR = 0.5
// 5 seconds
const UPLOAD_INITIAL_DELAY = 5e3
// 1.5 minute
const UPLOAD_MAX_DELAY = 9e4

// 1 second
const DEPLOY_POLL = 1e3

module.exports = {
  DEFAULT_DEPLOY_TIMEOUT,
  DEFAULT_CONCURRENT_HASH,
  DEFAULT_CONCURRENT_UPLOAD,
  DEFAULT_SYNC_LIMIT,
  DEFAULT_MAX_RETRY,
  UPLOAD_RANDOM_FACTOR,
  UPLOAD_INITIAL_DELAY,
  UPLOAD_MAX_DELAY,
  DEPLOY_POLL,
}
