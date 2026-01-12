import { Readable } from 'stream'
import type { IncomingMessage } from 'http'

import { parse as parseContentType } from 'content-type'
import type { RequestHandler } from 'express'
import multiparty from 'multiparty'
import getRawBody from 'raw-body'

import { warn } from '../../utils/command-helpers.js'
import { BACKGROUND } from '../../utils/functions/index.js'
import { capitalize } from '../string.js'

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

    const fakeRequest = Object.assign(
      new Readable({
        read() {
          this.push(req.body)
          this.push(null)
        },
      }),
      { headers: req.headers },
    ) as IncomingMessage

    const handlerName = getFormHandler({ functionsRegistry })
    if (!handlerName) {
      next()
      return
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
        ;[fields, files] = await new Promise<
          [
            Record<string, string | string[]>,
            Record<
              string,
              | { filename: string; size: number; type: string; url: string }
              | { filename: string; size: number; type: string; url: string }[]
            >,
          ]
        >((resolve, reject) => {
          const form = new multiparty.Form({ encoding: ct.parameters.charset || 'utf8' })
          form.parse(fakeRequest, (err: Error, formFields: multiparty.Fields, formFiles: multiparty.Files) => {
            if (err) {
              reject(err)
              return
            }

            const filesTransformed = Object.entries(formFiles).reduce(
              (prev, [name, values]) => ({
                ...prev,
                [name]: values.map((value) => ({
                  filename: value.originalFilename,
                  size: value.size,
                  type: value.headers['content-type'],
                  url: value.path,
                })),
              }),
              {} as Record<string, { filename: string; size: number; type: string; url: string }[]>,
            )

            resolve([
              Object.entries(formFields).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {} as Record<string, string | string[]>,
              ),
              Object.entries(filesTransformed).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {} as Record<
                  string,
                  | { filename: string; size: number; type: string; url: string }
                  | { filename: string; size: number; type: string; url: string }[]
                >,
              ),
            ])
          })
        })
      } catch (error) {
        warn(String(error))
        next()
        return
      }
    } else {
      warn('Invalid Content-Type for Netlify Dev forms request')
      next()
      return
    }

    const findValue = (possibleProps: string[]) => {
      const key = Object.keys(fields).find((name) => possibleProps.includes(name.toLowerCase()))
      return key ? fields[key] : undefined
    }

    const filesAsUrls = Object.entries(files).reduce(
      (prev, [name, value]) => ({ ...prev, [name]: Array.isArray(value) ? value.map(({ url }) => url) : value.url }),
      {} as Record<string, string | string[]>,
    )

    const data = JSON.stringify({
      payload: {
        company: findValue(['company', 'business', 'employer']),
        last_name: findValue(['lastname', 'surname', 'byname']),
        first_name: findValue(['firstname', 'givenname', 'forename']),
        name: findValue(['name', 'fullname']),
        email: findValue(['email', 'mail', 'from', 'twitter', 'sender']),
        title: findValue(['title', 'subject']),
        data: {
          ...fields,
          ...files,
          ip: req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          referrer: req.headers.referer,
        },
        created_at: new Date().toISOString(),
        human_fields: Object.entries({ ...fields, ...filesAsUrls }).reduce(
          (prev, [key, val]) => ({ ...prev, [capitalize(key)]: val }),
          {},
        ),
        ordered_human_fields: Object.entries({ ...fields, ...filesAsUrls }).map(([key, val]) => ({
          title: capitalize(key),
          name: key,
          value: val,
        })),
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
