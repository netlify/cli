// Local deploy timeout: 20 mins
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_DE... Remove this comment to see the full error message
const DEFAULT_DEPLOY_TIMEOUT = 1.2e6
// Concurrent file hash calls
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_CO... Remove this comment to see the full error message
const DEFAULT_CONCURRENT_HASH = 1e2
// Number of concurrent uploads
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_CO... Remove this comment to see the full error message
const DEFAULT_CONCURRENT_UPLOAD = 5
// Number of files
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_SY... Remove this comment to see the full error message
const DEFAULT_SYNC_LIMIT = 1e2
// Number of times to retry an upload
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_MA... Remove this comment to see the full error message
const DEFAULT_MAX_RETRY = 5

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'UPLOAD_RAN... Remove this comment to see the full error message
const UPLOAD_RANDOM_FACTOR = 0.5
// 5 seconds
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'UPLOAD_INI... Remove this comment to see the full error message
const UPLOAD_INITIAL_DELAY = 5e3
// 1.5 minute
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'UPLOAD_MAX... Remove this comment to see the full error message
const UPLOAD_MAX_DELAY = 9e4

// 1 second
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEPLOY_POL... Remove this comment to see the full error message
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
