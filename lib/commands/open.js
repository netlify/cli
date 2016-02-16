var webui       = require("../helpers/webui"),
    errorLogger = require("../helpers/error_logger");

exports.cmd = function(config, cmd) {
  config.getSite(cmd).then(function(site) {
    return webui.open("/sites/" + site.name);
  }).catch(function(err) {
    errorLogger.log("Error opening site admin: ", err);
    process.exit(1);
  });
}
