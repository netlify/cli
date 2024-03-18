import WebSocket from 'ws';
export const getWebSocket = (url) => new WebSocket(url);
