const DEFAULT_SRC_DIR = 'netlify/edge-functions'
const DIST_IMPORT_MAP_PATH = 'edge-functions-import-map.json'
const INTERNAL_EDGE_FUNCTIONS_FOLDER = 'edge-functions'
const EDGE_FUNCTIONS_FOLDER = 'edge-functions-dist'
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
