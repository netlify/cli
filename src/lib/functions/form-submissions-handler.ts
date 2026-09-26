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

type FormFieldValue = string | string[]

interface FormFile {
  filename: string
  size: number
  type: string | undefined
  url: string
}

const mapValues = <T, U>(record: Record<string, T>, mapper: (value: T) => U): Record<string, U> =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, mapper(value)]))

const unwrapSingleValues = <T>(record: Record<string, T[] | undefined>): Record<string, T | T[]> =>
  Object.fromEntries(
    Object.entries(record).flatMap(([key, values]) =>
      values === undefined ? [] : [[key, values.length > 1 ? values : values[0]]],
    ),
  )

const findField = (fields: Record<string, FormFieldValue>, aliases: string[]): FormFieldValue | undefined => {
  const fieldName = Object.keys(fields).find((name) => aliases.includes(name.toLowerCase()))
  return fieldName === undefined ? undefined : fields[fieldName]
}

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

    const ct = parseContentType(req)
    const { charset }: { charset?: string } = ct.parameters
    let fields: Record<string, FormFieldValue> = {}
    let files: Record<string, FormFile | FormFile[]> = {}
    if (ct.type.endsWith('/x-www-form-urlencoded')) {
      const bodyData = await getRawBody(fakeRequest, {
        length: req.headers['content-length'],
        limit: '10mb',
        encoding: charset || true,
      })

      fields = Object.fromEntries(new URLSearchParams(bodyData))
    } else if (ct.type === 'multipart/form-data') {
      try {
        ;[fields, files] = await new Promise<[typeof fields, typeof files]>((resolve, reject) => {
          const form = new multiparty.Form({ encoding: charset || 'utf8' })
          // @ts-expect-error -- multiparty only needs a readable stream with headers, but its types require an `IncomingMessage`
          form.parse(fakeRequest, (err, parsedFields, parsedFiles) => {
            if (err) {
              reject(err)
              return
            }
            resolve([
              unwrapSingleValues(parsedFields),
              unwrapSingleValues(
                mapValues(parsedFiles, (values) =>
                  values?.map((value) => ({
                    filename: value.originalFilename,
                    size: value.size,
                    type: value.headers?.['content-type'],
                    url: value.path,
                  })),
                ),
              ),
            ])
          })
        })
      } catch (error) {
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        warn(error)
        next()
        return
      }
    } else {
      warn('Invalid Content-Type for Netlify Dev forms request')
      next()
      return
    }
    const fileURLs = mapValues(files, (file) => (Array.isArray(file) ? undefined : file.url))
    const data = JSON.stringify({
      payload: {
        company: findField(fields, ['company', 'business', 'employer']),
        last_name: findField(fields, ['lastname', 'surname', 'byname']),
        first_name: findField(fields, ['firstname', 'givenname', 'forename']),
        name: findField(fields, ['name', 'fullname']),
        email: findField(fields, ['email', 'mail', 'from', 'twitter', 'sender']),
        title: findField(fields, ['title', 'subject']),
        data: {
          ...fields,
          ...files,
          ip: req.socket.remoteAddress,
          user_agent: req.headers['user-agent'],
          referrer: req.headers.referer,
        },
        created_at: new Date().toISOString(),
        human_fields: Object.fromEntries(
          Object.entries({ ...fields, ...fileURLs }).map(([key, val]) => [capitalize(key), val]),
        ),
        ordered_human_fields: Object.entries({ ...fields, ...fileURLs }).map(([key, val]) => ({
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
