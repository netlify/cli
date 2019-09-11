let URLclass = null

function parseURL(url) {
  if (typeof window !== 'undefined' && window.URL) {
    return new window.URL(url)
  }

  URLclass = URLclass || require('url')
  return URLclass.parse(url)
}

module.exports = {
  FULL_URL_MATCHER: /^(https?):\/\/(.+)$/,
  FORWARD_STATUS_MATCHER: /^2\d\d!?$/,

  isInvalidSource: function(redirect) {
    return redirect.path.match(/^\/\.netlify/)
  },
  isProxy: function(redirect) {
    return (
      redirect.proxy ||
      (redirect.to.match(/^https?:\/\//) && redirect.status === 200)
    )
  },
  parseFullOrigin: function(origin) {
    let url = null
    try {
      url = parseURL(origin)
    } catch (e) {
      return null
    }

    return {
      host: url.host,
      scheme: url.protocol.replace(/:$/, ''),
      path: url.path,
    }
  },
}
