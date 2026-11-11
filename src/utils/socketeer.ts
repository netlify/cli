const getSocketeerUrl = (): string => {
  // An empty value means unset, as with NETLIFY_API_URL.
  if (process.env.NETLIFY_SOCKETEER_URL) {
    return process.env.NETLIFY_SOCKETEER_URL
  }
  return 'wss://socketeer.services.netlify.com'
}

export const SOCKETEER_URL = getSocketeerUrl()
