var chalk = require("chalk"),
    site_picker = require("../helpers/site_picker"),
    webui = require("../helpers/webui");

exports.cmd = function(config, cmd) {
  site_picker.pickSite(config.client, {guest: cmd.guest}, function(err, site) {
    webui.open("/sites/" + site.name, function() {
      console.log("  Site ID: " + chalk.bold(site.id));
    });
  });
};
