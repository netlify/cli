var chalk = require("chalk"),
    webui = require("../helpers/webui");

exports.cmd = function(config, cmd) {
  config.getSite(cmd).then(function(site) {
    return webui.open("/sites/" + site.name);
  }).catch(function(err) {
    console.log("Error opening site admin:");
    console.log("  " + chalk.bold(err));
  });
}
