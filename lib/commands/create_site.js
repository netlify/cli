var chalk = require("chalk"),
    errorLogger = require("../helpers/error_logger");

exports.cmd = function(config, cmd) {
  var options = {};
  options.name = cmd.name
  options.customDomain = cmd.customDomain
  options.password = cmd.password
  console.log("Creating new site");
  config.client.createSite(options).then(function(site) {
    console.log("Site created: " + chalk.bold(site.admin_url));
    config.writeLocalConfig({site_id: site.id});
  }).catch(function(err) {
    errorLogger.log("Error creating site", err);
    process.exit(1);
  });
}
