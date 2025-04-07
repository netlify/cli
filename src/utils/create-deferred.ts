const createDeferred = <T>() => {
  let resolveDeferred!: (value: T) => void
  let rejectDeferred!: (reason: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve
    rejectDeferred = reject
  })

  return { promise, reject: rejectDeferred, resolve: resolveDeferred }
}

export default createDeferred
