var chalk       = require("chalk"),
    site_picker = require("../helpers/site_picker"),
    webui       = require("../helpers/webui"),
    errorLogger = require("../helpers/error_logger");

exports.cmd = function(config, cmd) {
  site_picker.pickSite(config.client, {guest: cmd.guest}).then(function(site) {
    return webui.open("/sites/" + site.name).then(function() {
      console.log("  Site ID: " + chalk.bold(site.id));
    });
  }).catch(function(err) {
    errorLogger.log("Error during site listing: ", err);
    process.exit(1);
  });
};
