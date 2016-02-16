var chalk = require("chalk"),
    errorLogger = require("../helpers/error_logger");

exports.cmd = function(config, deployId, cmd) {
  config.getSite(cmd).then(function(site) {
    site.deploy(deployId).then(function(deploy) {
      deploy.publish().then(function(deploy) {
        console.log("Deploy is now live:\n  " + chalk.bold(site.url));
      });
    });
  }).catch(function(err) {
    errorLogger.log("Error publishing deploy", err);
    process.exit(1);
  });
}
