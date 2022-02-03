const pause = (interval) =>
  new Promise((resolve) => {
    setTimeout(resolve, interval)
  })

module.exports = { pause }
