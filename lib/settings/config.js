var netlify = require("netlify"),
    path    = require("path"),
    homeDir = require("home-dir"),
    fs      = require("fs"),
    chalk   = require("chalk"),
    webauth = require("./webauth");

var CLIENT_ID         = process.env.NETLIFY_CLIENT_ID || "72908619e7f7fb5ed28f800a488b4cc0a868a277cfc94cc846a54e80a329486b",
    WEBUI             = process.env.NETLIFY_WEB_UI || "http://localhost:9009",
    API_ENDPOINT      = process.env.NETLIFY_ENDPOINT,
    PREVIEW_DOMAIN    = process.env.NETLIFY_PREVIEW_DOMAIN || "netlify.lo",
    CONFIG_DIR        = path.join(homeDir(), '.netlify'),
    LOCAL_CONFIG_PATH = path.join(process.cwd(), ".netlify");


var readLocalConfig = function() {
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH));
  }
  return null;
}

var Config = function(options) {
  for (var k in options) {
    this[k] = options[k]
  }
}

var isUUID = function(val) {
  if (val.indexOf("-") == -1) { return false }
  var parts = val.split("-");
  return parts[0].length == 8 &&
         parts[1].length == 4 &&
         parts[2].length == 4 &&
         parts[3].length == 4 &&
         parts[4].length == 12;
}

Config.prototype.getSiteId = function(cmd) {
  var siteId = cmd.siteId || this.siteId;

  if (siteId == null) { return null; }

  if (isUUID(siteId) || siteId.indexOf(".") > 0) {
    return siteId;
  } else {
    return siteId + "." + PREVIEW_DOMAIN;
  }
}

Config.prototype.getSite = function(cmd, cb) {
  var siteId = this.getSiteId(cmd);

  if (siteId == null) {
    console.log("No site id specified");
    process.exit(1);
  }

  this.client.site(siteId, function(err, site) {
    if (err) {
      console.log("Site not found: " + chalk.bold(err));
      process.exit(1);
    }

    cb(site);
  });
}

Config.prototype.getPath = function(cmd) {
  return cmd.path || this.path || process.cwd();
}

Config.prototype.writeLocalConfig = function(options) {
  fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(options));
}

Config.prototype.deleteLocalConfig = function() {
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    fs.unlinkSync(LOCAL_CONFIG_PATH);
  }
}

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
  var local = readLocalConfig();
  if (program.accessToken) {
    config.client = netlify.createClient({
      client_id: CLIENT_ID,
      access_token: program.accessToken,
      endpoint: API_ENDPOINT
    });
    config.siteId = local && local.site_id;
    config.path = local && local.path;
    cb(config);
  } else {
    readOrCreateConfig(function(err, config) {
      config.client = netlify.createClient({
        client_id: CLIENT_ID,
        access_token: (local && local.access_token) || config.access_token,
        endpoint: API_ENDPOINT
      });
      config.siteId = local && local.site_id;
      config.path = local && local.path;
      cb(config);
    });
  }
};

/* Wrap a function with the config loader.
   Load config from file, from cli options or create a new config
   throug web authentication. */
exports.wrap = function(program, method) {
  return function(cmd) {
    var args = Array.prototype.slice.call(arguments, 0);
    newConfig(program, function(config) {
      method.apply(method, [new Config(config)].concat(args));
    });
  }
}
