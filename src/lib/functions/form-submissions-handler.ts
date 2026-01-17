import { Readable } from 'stream'

import { parse as parseContentType } from 'content-type'
import type { RequestHandler } from 'express'
import multiparty from 'multiparty'
import getRawBody from 'raw-body'

import { warn } from '../../utils/command-helpers.js'
import { BACKGROUND } from '../../utils/functions/index.js'
import { capitalize } from '../string.js'

const getFieldValue = (fields: FormFields, potentialKeys: string[]) => {
  const key = Object.keys(fields).find((name) => potentialKeys.includes(name.toLowerCase()))

  return key ? fields[key] : undefined
}

type FormFields = Record<string, string | string[]>
type FormFile = {
  filename: string
  size: number
  type: string
  url: string
}
type FormFiles = Record<string, FormFile | FormFile[]>

import type NetlifyFunction from './netlify-function.js'
import type { FunctionsRegistry } from './registry.js'
import type { BaseBuildResult } from './runtimes/index.js'

export const getFormHandler = function ({
  functionsRegistry,
  logWarning = true,
}: {
  functionsRegistry: FunctionsRegistry
  logWarning?: boolean
}) {
  const handlers = ['submission-created', `submission-created${BACKGROUND}`]
    .map((name) => functionsRegistry.get(name))
    .filter((func): func is NetlifyFunction<BaseBuildResult> => func != null)
    .map(({ name }) => name)

  if (handlers.length === 0) {
    if (logWarning) {
      warn(`Missing form submission function handler`)
    }
    return
  }

  if (handlers.length === 2) {
    if (logWarning) {
      warn(
        `Detected both '${handlers[0]}' and '${handlers[1]}' form submission functions handlers, using ${handlers[0]}`,
      )
    }
  }

  return handlers[0]
}

export const createFormSubmissionHandler = function ({
  functionsRegistry,
  siteUrl,
}: {
  functionsRegistry: FunctionsRegistry
  siteUrl: string
}): RequestHandler {
  return async function formSubmissionHandler(req, _res, next) {
    if (
      req.url.startsWith('/.netlify/') ||
      req.method !== 'POST' ||
      (await functionsRegistry.getFunctionForURLPath(req.url, req.method, () => Promise.resolve(false)))
    ) {
      next()
      return
    }

    const fakeRequest = new Readable({
      read() {
        this.push(req.body)
        this.push(null)
      },
    }) as unknown as import('http').IncomingMessage
    fakeRequest.headers = req.headers

    const handlerName = getFormHandler({ functionsRegistry })
    if (!handlerName) {
      next()
      return
    }

    const originalUrl = new URL(req.url, 'http://localhost')
    req.url = `/.netlify/functions/${handlerName}${originalUrl.search}`

    const ct = parseContentType(req)
    let fields: FormFields = {}
    let files: FormFiles = {}
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
          form.parse(
            fakeRequest,
            (
              err: Error | null,
              Fields: Record<string, string[] | undefined>,
              Files: Record<string, multiparty.File[] | undefined>,
            ) => {
              if (err) {
                reject(err)
                return
              }

              const mappedFiles = Object.entries(Files).reduce(
                (prev, [name, values]) => {
                  if (!values) {
                    return prev
                  }

                  return {
                    ...prev,
                    [name]: values.map((value) => ({
                      filename: value.originalFilename,
                      size: value.size,
                      type: value.headers?.['content-type'],
                      url: value.path,
                    })),
                  }
                },
                {} as Record<string, FormFile[]>,
              )

              resolve([
                Object.entries(Fields).reduce((prev, [name, values]) => {
                  if (!values) {
                    return prev
                  }

                  return { ...prev, [name]: values.length > 1 ? values : values[0] }
                }, {}),
                Object.entries(mappedFiles).reduce(
                  (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                  {},
                ),
              ])
            },
          )
        })
      } catch (error) {
        warn(error as string)
        next()
        return
      }
    } else {
      warn('Invalid Content-Type for Netlify Dev forms request')
      next()
      return
    }
    const data = JSON.stringify({
      payload: {
        company: getFieldValue(fields, ['company', 'business', 'employer']),
        last_name: getFieldValue(fields, ['lastname', 'surname', 'byname']),
        first_name: getFieldValue(fields, ['firstname', 'givenname', 'forename']),
        name: getFieldValue(fields, ['name', 'fullname']),
        email: getFieldValue(fields, ['email', 'mail', 'from', 'twitter', 'sender']),
        title: getFieldValue(fields, ['title', 'subject']),
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
          ...Object.entries(files).reduce((prev, [name, file]) => {
            const url = Array.isArray(file) ? file.map((entry) => entry.url) : file.url

            return { ...prev, [name]: url }
          }, {}),
        }).reduce((prev, [key, val]) => ({ ...prev, [capitalize(key)]: val }), {}),
        ordered_human_fields: Object.entries({
          ...fields,
          ...Object.entries(files).reduce((prev, [name, file]) => {
            const url = Array.isArray(file) ? file.map((entry) => entry.url) : file.url

            return { ...prev, [name]: url }
          }, {}),
        }).map(([key, val]) => ({ title: capitalize(key), name: key, value: val })),
        site_url: siteUrl,
      },
    })
    req.body = data
    req.headers = {
      ...req.headers,
      'content-length': String(data.length),
      'content-type': 'application/json',
      'x-netlify-original-pathname': originalUrl.pathname,
      'x-netlify-original-search': originalUrl.search,
    }

    next()
  }
}
