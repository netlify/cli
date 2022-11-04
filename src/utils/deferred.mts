// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createDefe... Remove this comment to see the full error message
const createDeferred = () => {
  let resolveDeferred
  let rejectDeferred
  const promise = new Promise((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return { promise, reject: rejectDeferred, resolve: resolveDeferred }
}

module.exports = { createDeferred }
