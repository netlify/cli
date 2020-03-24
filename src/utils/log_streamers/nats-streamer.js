const WebSocket = require('isomorphic-ws');

class NatsStreamer {
  constructor({ deployId, date, persisted, accessToken }, fetchLog) {
    this.deployId = deployId;
    this.date = new Date(date);
    this.backoff = 1000;
    this.reset = false;
    this.persisted = persisted;
    this.fetchLog = fetchLog;
    this.accessToken = accessToken;
  }

  listen(updater, errorHandler) {
    if (this.persisted) {
      return this.fetchLog(this.deployId)
        .then(data => {
          let reset = true;
          data.forEach(line => {
            updater({
              reset,
              ts: line.ts,
              log: line.msg
            });
            reset = false;
          });
        })
        .catch(errorHandler);
    } else {
      const yesterday = new Date() - ( 1000 * 60 * 60 * 24);
      if (this.date < yesterday) {
        updater({
          reset: true,
          ts: new Date().getTime(),
          log: "Build log has expired..."
        });
        return;
      }
    }

    this.ws = new WebSocket("wss://buildlogs.services.netlify.com/deploylog");
    this.ws.onmessage = e => {
      const data = JSON.parse(e.data);
      data.reset = this.reset;
      this.reset = false;
      updater(data);
    };
    this.ws.onopen = e => {
      this.ws.send(
        JSON.stringify({
          access_token: this.accessToken,
          deploy_id: this.deployId
        })
      );
    };
    this.ws.onclose = e => {
      this.reset = true;
      setTimeout(() => this.listen(updater), this.backoff);
      this.backoff = Math.max(this.backoff * 2, 30);
    };
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.backoff = 0;
    this.reset = false;
  }
}

module.exports = NatsStreamer;
