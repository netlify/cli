const FirebaseStreamer = require("./firebase");
const HumioStreamer = require("./humiobase");
const NatsStreamer = require("./nats-streamer");
const SocketeerStreamer = require("./socketeer");

const providers = {
  firebase: FirebaseStreamer,
  humio: HumioStreamer,
  nats_streaming: NatsStreamer,
  socketeer: SocketeerStreamer
};

function getLogStreamer(attributes, deploy, fetchLog) {
  const klass = providers[attributes.type];
  return klass && new klass(attributes, deploy, fetchLog);
}

module.exports = getLogStreamer
