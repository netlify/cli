module.exports = {
  name: 'auth-fetch',
  description: 'Use `node-fetch` library and Netlify Identity to access APIs',
  onComplete() {
    console.log(`auth-fetch function created from template!`)
    console.log(
      'REMINDER: Make sure to call this function with the Netlify Identity JWT. See https://netlify-gotrue-in-react.netlify.com/ for demo'
    )
  },
}
