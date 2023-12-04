import type http from 'http'

import { NetlifyConfig } from '@netlify/build'
import express, { Express } from 'express'
import { NetlifyAPI } from 'netlify'

import getGlobalConfig from '../../utils/get-global-config.js'
import StateConfig from '../../utils/state-config.js'

import { UIContext } from './context.js'
import { handleCreateFunction } from './endpoints/create-function.js'
import { handleHandshake } from './endpoints/handshake.js'
import { handleStatus } from './endpoints/status.js'

const DEV_UI_PATH_PREFIX = '/.netlify/dev'

export type DevUIProxy = Express

export const isDevUIRequest = (req: http.IncomingMessage) => req.url?.startsWith(DEV_UI_PATH_PREFIX)

interface InitializeProxyOptions {
  config: NetlifyConfig
  projectDir: string
  api: NetlifyAPI
  state: StateConfig
  siteInfo: any
  site: any
}

export const initializeProxy = async ({ api, config, projectDir, site, siteInfo, state }: InitializeProxyOptions) => {
  const app = express()
  const devUI = express()
  const globalConfig = await getGlobalConfig()
  const context: UIContext = { config, projectDir, api, state, siteInfo, globalConfig, site }

  app.use(DEV_UI_PATH_PREFIX, (req, res, next) => {
    // TODO: Scope this down to `app.netlify.com`.
    res.set('Access-Control-Allow-Origin', '*')

    return devUI(req, res, next)
  })

  devUI.post('/', handleHandshake)
  devUI.post('/create-function', handleCreateFunction.bind(null, context))
  devUI.get('/status', handleStatus.bind(null, context))

  return app
}
