export const pause = (interval) =>
  new Promise((resolve) => {
    setTimeout(resolve, interval)
  })
