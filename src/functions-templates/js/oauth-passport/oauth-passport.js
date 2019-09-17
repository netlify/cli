// details: https://markus.oberlehner.net/blog/implementing-an-authentication-flow-with-passport-and-netlify-functions/

const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const express = require('express')
const passport = require('passport')
const serverless = require('serverless-http')

require('./utils/auth')

const { COOKIE_SECURE, ENDPOINT } = require('./utils/config')

const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(passport.initialize())

const handleCallback = () => (req, res) => {
  res.cookie('jwt', req.user.jwt, { httpOnly: true, COOKIE_SECURE }).redirect('/')
}

app.get(`${ENDPOINT}/auth/github`, passport.authenticate('github', { session: false }))
app.get(
  `${ENDPOINT}/auth/github/callback`,
  passport.authenticate('github', { failureRedirect: '/', session: false }),
  handleCallback()
)

app.get(`${ENDPOINT}/auth/status`, passport.authenticate('jwt', { session: false }), (req, res) =>
  res.json({ email: req.user.email })
)

module.exports.handler = serverless(app)
