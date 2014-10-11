var netlify = require("netlify"),
    path    = require("path"),
    homeDir = require("home-dir"),
    fs      = require("fs"),
    webauth = require("./webauth");


var CLIENT_ID     = process.env.NETLIFY_CLIENT_ID || "72908619e7f7fb5ed28f800a488b4cc0a868a277cfc94cc846a54e80a329486b",
    WEBUI         = process.env.NETLIFY_WEB_UI || "http://localhost:9009",
    API_ENDPOINT  = process.env.NETLIFY_ENDPOINT,
    CONFIG_DIR    = path.join(homeDir(), '.netlify');;


var readOrCreateConfig = function(cb) {
  var configPath = path.join(CONFIG_DIR, "config"),
      config = null;
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath));
    cb(null, config);
  } else {
    var client = netlify.createClient({client_id: CLIENT_ID, endpoint: API_ENDPOINT});
    webauth.login({client: client, webui: WEBUI}, function(err, token) {
      config = {access_token: token.access_token};
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR);
      }
      fs.writeFileSync(configPath, JSON.stringify(config));
      cb(null, config);
    });
  }
};

var newConfig = function(program, cb) {
  var config = {};
  if (program.accessToken) {
    config.client = netlify.createClient({
      client_id: CLIENT_ID,
      access_token: program.accessToken,
      endpoint: API_ENDPOINT
    });
    cb(config);
  } else {
    readOrCreateConfig(function(err, config) {
      config.client = netlify.createClient({
        client_id: CLIENT_ID,
        access_token: config.access_token,
        endpoint: API_ENDPOINT
      });
      cb(config);
    });
  }
};

/* Wrap a function with the config loader.
   Load config from file, from cli options or create a new config
   throug web authentication. */
exports.wrap = function(method) {
  return function(cmd) {
    var args = arguments;
    newConfig(cmd, function(config) {
      method.apply(method, [config].concat(args));
    });
  }
}
