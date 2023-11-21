import WebSocket from 'ws'

export const getWebSocket = (url: string) => new WebSocket(url)
