module.exports = {
  name: 'create-user',
  description: 'Programmatically create a Netlify Identity user by invoking a function',
  onComplete() {
    console.log(`create-user function created from template!`)
    console.log(
      'REMINDER: Make sure to call this function with a Netlify Identity JWT. See https://netlify-gotrue-in-react.netlify.com/ for demo',
    )
  },
}
