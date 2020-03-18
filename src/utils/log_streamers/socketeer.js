const url = require("url");

const LogResources = require("./resources");
const WebSocket = require('isomorphic-ws');

const socketeerApiBase = "wss://socketeer.services.netlify.com"

function logError(error) {
  console.error(error);
}

const projectIdFromEndpoint = endpoint => {
  const host = new url.URL(endpoint).hostname;
  if (!host.endsWith(".firebaseio.com")) {
    throw new Error("invalid firebase endpoint");
  }
  return host.replace(".firebaseio.com", "");
};

class SocketeerStreamer {
  constructor(attributes) {
    switch (attributes.resource) {
      case LogResources.BUILD:
        this._initBuildLog(attributes);
        break;
      case LogResources.FUNCTION:
        this._initFunctionLog(attributes);
        break;
      default:
        throw new Error("unknown log type");
    }
  }

  _initBuildLog(attributes) {
    this.path = "/build/logs";
    this.subscribeMsg = {
      access_token: attributes.apiToken,
      project_id:
        attributes.fbProjectId || projectIdFromEndpoint(attributes.endpoint),
      build_id: attributes.buildId
    };
  }

  _initFunctionLog(attributes) {
    this.path = "/function/logs";
    this.subscribeMsg = {
      access_token: attributes.apiToken,
      account_id: attributes.awsAccountId,
      function_id: attributes.functionId,
      site_id: attributes.siteId
    };
  }

  listen(updater, errorHandler = logError) {
    const url = `${socketeerApiBase}${this.path}`;
    this.ws = new WebSocket(url);
    this.ws.addEventListener("open", () => {
      this.ws.send(JSON.stringify(this.subscribeMsg));
    });
    this.ws.addEventListener("message", ({ data }) => {
      try {
        const { ts, message, type } = JSON.parse(data);
        if (type === "start") {
          return;
        }
        updater({
          ts,
          type,
          log: message
        });
      } catch (e) {
        errorHandler(e);
      }
    });
    this.ws.addEventListener("error", errorHandler);
  }

  close() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      return;
    }
    this.ws.close();
    this.ws = null;
  }
}

module.exports = SocketeerStreamer;
