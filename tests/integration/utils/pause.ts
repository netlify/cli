export const pause = (interval: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, interval)
  })
