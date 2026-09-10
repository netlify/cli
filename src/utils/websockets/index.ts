import WebSocket from 'ws'

import { getRequestUserAgent } from '../user-agent.js'

export const getWebSocket = (url: string) => new WebSocket(url, { headers: { 'User-Agent': getRequestUserAgent() } })
