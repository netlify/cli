const DEFAULT_SRC_DIR = 'netlify/edge-functions'
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DIST_IMPOR... Remove this comment to see the full error message
const DIST_IMPORT_MAP_PATH = 'edge-functions-import-map.json'
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'INTERNAL_E... Remove this comment to see the full error message
const INTERNAL_EDGE_FUNCTIONS_FOLDER = 'edge-functions'
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'EDGE_FUNCT... Remove this comment to see the full error message
const EDGE_FUNCTIONS_FOLDER = 'edge-functions-dist'
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'PUBLIC_URL... Remove this comment to see the full error message
const PUBLIC_URL_PATH = '.netlify/internal/edge-functions'

// 1 second
const SERVER_POLL_INTERNAL = 1e3

// 10 seconds
const SERVER_POLL_TIMEOUT = 1e4

module.exports = {
  DEFAULT_SRC_DIR,
  DIST_IMPORT_MAP_PATH,
  INTERNAL_EDGE_FUNCTIONS_FOLDER,
  EDGE_FUNCTIONS_FOLDER,
  PUBLIC_URL_PATH,
  SERVER_POLL_INTERNAL,
  SERVER_POLL_TIMEOUT,
}
