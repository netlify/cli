// @ts-check
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'createDefe... Remove this comment to see the full error message
const createDeferred = () => {
  let resolveDeferred
  let rejectDeferred
  const promise = new Promise((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return { promise, reject: rejectDeferred, resolve: resolveDeferred }
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { createDeferred }
