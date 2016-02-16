var chalk = require("chalk"),
    errorLogger = require("../helpers/error_logger");

exports.cmd = function(config, cmd) {
  config.getSite(cmd).then(function(site) {
    var options = {};
    if (cmd.hasOwnProperty("name")) { options.name = cmd.name; }
    if (cmd.hasOwnProperty("customDomain")) { options.customDomain = cmd.customDomain === true ? "" : cmd.customDomain; }
    if (cmd.hasOwnProperty("password")) { options.password = cmd.password === true ? "" : cmd.password; }

    return site.update(options).then(function(site) {
      console.log("Site updated:\n  " + chalk.bold(site.url));
    });
  }).catch(function(err) {
    errorLogger.log("Error updating site: ", err);
    process.exit(1);
  });
}
