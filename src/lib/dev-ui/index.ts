import type http from 'http'

import { NetlifyConfig } from '@netlify/build'
import express, { Express } from 'express'

import { handleCreateFunction } from './endpoints/create-function.js'
import { handleHandshake } from './endpoints/handshake.js'

const DEV_UI_PATH_PREFIX = '/.netlify/dev'

export type DevUIProxy = Express

export const isDevUIRequest = (req: http.IncomingMessage) => req.url?.startsWith(DEV_UI_PATH_PREFIX)

interface InitializeProxyOptions {
  config: NetlifyConfig
  projectDir: string
}

export const initializeProxy = ({ config, projectDir }: InitializeProxyOptions) => {
  const app = express()
  const devUI = express()
  const context = { config, projectDir }

  app.use(DEV_UI_PATH_PREFIX, (req, res, next) => {
    // TODO: Scope this down to `app.netlify.com`.
    res.set('Access-Control-Allow-Origin', '*')

    return devUI(req, res, next)
  })

  devUI.post('/', handleHandshake)
  devUI.post('/create-function', handleCreateFunction.bind(null, context))

  return app
}
