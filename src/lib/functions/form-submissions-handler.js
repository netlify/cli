// @ts-check
const { Readable } = require('stream')

const { parse: parseContentType } = require('content-type')
const multiparty = require('multiparty')
const getRawBody = require('raw-body')

const { BACKGROUND } = require('../../utils')
const { warn } = require('../../utils/command-helpers')
const { capitalize } = require('../string')

const createFormSubmissionHandler = function ({ functionsRegistry, siteUrl }) {
  return async function formSubmissionHandler(req, res, next) {
    if (req.url.startsWith('/.netlify/') || req.method !== 'POST') return next()

    const fakeRequest = new Readable({
      read() {
        this.push(req.body)
        this.push(null)
      },
    })
    fakeRequest.headers = req.headers

    const handlerName = getFormHandler({ functionsRegistry })
    if (!handlerName) {
      return next()
    }

    const originalUrl = new URL(req.url, 'http://localhost')
    req.url = `/.netlify/functions/${handlerName}${originalUrl.search}`

    const ct = parseContentType(req)
    let fields = {}
    let files = {}
    if (ct.type.endsWith('/x-www-form-urlencoded')) {
      const bodyData = await getRawBody(fakeRequest, {
        length: req.headers['content-length'],
        limit: '10mb',
        encoding: ct.parameters.charset,
      })

      fields = Object.fromEntries(new URLSearchParams(bodyData.toString()))
    } else if (ct.type === 'multipart/form-data') {
      try {
        ;[fields, files] = await new Promise((resolve, reject) => {
          const form = new multiparty.Form({ encoding: ct.parameters.charset || 'utf8' })
          form.parse(fakeRequest, (err, Fields, Files) => {
            if (err) return reject(err)
            Files = Object.entries(Files).reduce(
              (prev, [name, values]) => ({
                ...prev,
                [name]: values.map((value) => ({
                  filename: value.originalFilename,
                  size: value.size,
                  type: value.headers && value.headers['content-type'],
                  url: value.path,
                })),
              }),
              {},
            )
            return resolve([
              Object.entries(Fields).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {},
              ),
              Object.entries(Files).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {},
              ),
            ])
          })
        })
      } catch (error) {
        warn(error)
        return next()
      }
    } else {
      warn('Invalid Content-Type for Netlify Dev forms request')
      return next()
    }
    const data = JSON.stringify({
      payload: {
        company:
          fields[Object.keys(fields).find((name) => ['company', 'business', 'employer'].includes(name.toLowerCase()))],
        last_name:
          fields[Object.keys(fields).find((name) => ['lastname', 'surname', 'byname'].includes(name.toLowerCase()))],
        first_name:
          fields[
            Object.keys(fields).find((name) => ['firstname', 'givenname', 'forename'].includes(name.toLowerCase()))
          ],
        name: fields[Object.keys(fields).find((name) => ['name', 'fullname'].includes(name.toLowerCase()))],
        email:
          fields[
            Object.keys(fields).find((name) =>
              ['email', 'mail', 'from', 'twitter', 'sender'].includes(name.toLowerCase()),
            )
          ],
        title: fields[Object.keys(fields).find((name) => ['title', 'subject'].includes(name.toLowerCase()))],
        data: {
          ...fields,
          ...files,
          ip: req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          referrer: req.headers.referer,
        },
        created_at: new Date().toISOString(),
        human_fields: Object.entries({
          ...fields,
          ...Object.entries(files).reduce((prev, [name, { url }]) => ({ ...prev, [name]: url }), {}),
        }).reduce((prev, [key, val]) => ({ ...prev, [capitalize(key)]: val }), {}),
        ordered_human_fields: Object.entries({
          ...fields,
          ...Object.entries(files).reduce((prev, [name, { url }]) => ({ ...prev, [name]: url }), {}),
        }).map(([key, val]) => ({ title: capitalize(key), name: key, value: val })),
        site_url: siteUrl,
      },
    })
    req.body = data
    req.headers = {
      ...req.headers,
      'content-length': data.length,
      'content-type': 'application/json',
      'x-netlify-original-pathname': originalUrl.pathname,
    }

    next()
  }
}

const getFormHandler = function ({ functionsRegistry }) {
  const handlers = ['submission-created', `submission-created${BACKGROUND}`]
    .map((name) => functionsRegistry.get(name))
    .filter(Boolean)
    .map(({ name }) => name)

  if (handlers.length === 0) {
    warn(`Missing form submission function handler`)
    return
  }

  if (handlers.length === 2) {
    warn(`Detected both '${handlers[0]}' and '${handlers[1]}' form submission functions handlers, using ${handlers[0]}`)
  }

  return handlers[0]
}

module.exports = { createFormSubmissionHandler }
