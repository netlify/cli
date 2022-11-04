// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'promisify'... Remove this comment to see the full error message
const { promisify } = require('util')

const walker = require('folder-walker')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'pump'.
const pump = promisify(require('pump'))

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileFilter... Remove this comment to see the full error message
const { fileFilterCtor, fileNormalizerCtor, hasherCtor, manifestCollectorCtor } = require('./hasher-segments.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'hashFiles'... Remove this comment to see the full error message
const hashFiles = async ({
  assetType = 'file',
  concurrentHash,
  directories,
  filter,
  hashAlgorithm = 'sha1',
  normalizer,
  statusCb
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  if (!filter) throw new Error('Missing filter function option')

  const fileStream = walker(directories, { filter })
  const fileFilter = fileFilterCtor()
  const hasher = hasherCtor({ concurrentHash, hashAlgorithm })
  const fileNormalizer = fileNormalizerCtor({ assetType, normalizer })

  // Written to by manifestCollector
  // normalizedPath: hash (wanted by deploy API)
  const files = {}
  // hash: [fileObj, fileObj, fileObj]
  const filesShaMap = {}
  const manifestCollector = manifestCollectorCtor(files, filesShaMap, { statusCb, assetType })

  await pump(fileStream, fileFilter, hasher, fileNormalizer, manifestCollector)

  return { files, filesShaMap }
}

module.exports = { hashFiles }
