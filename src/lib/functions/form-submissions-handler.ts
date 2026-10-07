import { Readable } from 'stream'

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

interface UploadedFile {
  filename: string
  size: number
  type: string | undefined
  url: string
}

type FormFields = Record<string, string | string[]>
type FormFiles = Record<string, UploadedFile | UploadedFile[]>

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
    )

    const handlerName = getFormHandler({ functionsRegistry })
    if (!handlerName) {
      next()
      return
    }

    const originalUrl = new URL(req.url, 'http://localhost')
    req.url = `/.netlify/functions/${handlerName}${originalUrl.search}`

    // A missing header parses to an empty type and takes the unsupported-type branch below.
    const ct = parseContentType(req.headers['content-type'] ?? '')
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
        ;[fields, files] = await new Promise<[FormFields, FormFiles]>((resolve, reject) => {
          const form = new multiparty.Form({ encoding: ct.parameters.charset || 'utf8' })
          form.parse(
            // @ts-expect-error FIXME(@types/multiparty): `parse` only reads `headers` and the body stream, but demands an `IncomingMessage`
            fakeRequest,
            (err: Error | null, rawFields: Record<string, string[]>, rawFiles: Record<string, multiparty.File[]>) => {
              if (err) {
                reject(err)
                return
              }
              const uploadedFiles: Record<string, UploadedFile[]> = Object.entries(rawFiles).reduce(
                (prev, [name, values]) => ({
                  ...prev,
                  [name]: values.map((value) => ({
                    filename: value.originalFilename,
                    size: value.size,
                    type: value.headers?.['content-type'],
                    url: value.path,
                  })),
                }),
                {},
              )
              resolve([
                Object.entries(rawFields).reduce(
                  (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                  {},
                ),
                Object.entries(uploadedFiles).reduce(
                  (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                  {},
                ),
              ])
            },
          )
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
    // FIXME: with no matching field, this reads the field literally named "undefined"
    const fieldMatching = (names: string[]) =>
      fields[String(Object.keys(fields).find((name) => names.includes(name.toLowerCase())))]
    const fileUrls = Object.entries(files).reduce(
      // @ts-expect-error FIXME: a field with several files holds an array, so its `url` is `undefined`
      (prev, [name, { url }]) => ({ ...prev, [name]: url }),
      {},
    )
    const data = JSON.stringify({
      payload: {
        company: fieldMatching(['company', 'business', 'employer']),
        last_name: fieldMatching(['lastname', 'surname', 'byname']),
        first_name: fieldMatching(['firstname', 'givenname', 'forename']),
        name: fieldMatching(['name', 'fullname']),
        email: fieldMatching(['email', 'mail', 'from', 'twitter', 'sender']),
        title: fieldMatching(['title', 'subject']),
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
          ...fileUrls,
        }).reduce((prev, [key, val]) => ({ ...prev, [capitalize(key)]: val }), {}),
        ordered_human_fields: Object.entries({
          ...fields,
          ...fileUrls,
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
