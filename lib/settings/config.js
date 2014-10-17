var netlify = require("netlify"),
    path    = require("path"),
    homeDir = require("home-dir"),
    fs      = require("fs"),
    chalk   = require("chalk"),
    webauth = require("./webauth");

var CLIENT_ID         = process.env.NETLIFY_CLIENT_ID || "5edad8f69d47ae8923d0cf0b4ab95ba1415e67492b5af26ad97f4709160bb31b",
    API_ENDPOINT      = process.env.NETLIFY_ENDPOINT,
    PREVIEW_DOMAIN    = process.env.NETLIFY_PREVIEW_DOMAIN || "netlify.com",
    CONFIG_DIR        = path.join(homeDir(), '.netlify'),
    CONFIG_PATH       = path.join(CONFIG_DIR, "config"),
    LOCAL_CONFIG_PATH = path.join(process.cwd(), ".netlify");

var readLocalConfig = function(env) {
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    conf = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH));
    return env ? conf[env] : conf;
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
  var local = readLocalConfig() || {},
      conf  = local;

  if (this.env) {
    local[this.env] = {};
    conf = local[this.env];
  }

  conf.site_id = options.site_id;
  conf.path    = options.path;

  fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(local));
}

Config.prototype.deleteLocalConfig = function() {
  this.writeLocalConfig({});
};

Config.prototype.write = function(data) {
  var config = readConfig();
  for (var key in data) {
    this[key] = data[key];
    config[key] = data[key];
  }
  writeConfig(config);
};

var readConfig = function() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH));
  }
  return null;
};

var writeConfig = function(data) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR);
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data));
}

var readOrCreateConfig = function(options, cb) {
  var config = readConfig();
  if (config) {
    cb(null, config);
  } else if (options.access_token) {
    cb(null, {access_token: options.access_token});
  } else {
    var client = netlify.createClient({client_id: CLIENT_ID, endpoint: API_ENDPOINT});
    webauth.login({client: client}, function(err, token) {
      config = {access_token: token.access_token};
      writeConfig(config);
      cb(null, config);
    });
  }
};

var newConfig = function(program, cb) {
  var local = readLocalConfig(program.env);
  readOrCreateConfig(program, function(err, config) {
    config.client = netlify.createClient({
      client_id: CLIENT_ID,
      access_token: (local && local.access_token) || config.access_token,
      endpoint: API_ENDPOINT
    });
    config.siteId = local && local.site_id;
    config.path = local && local.path;
    config.env = program.env;
    cb(config);
  });
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
