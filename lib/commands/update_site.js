var chalk = require("chalk");

exports.cmd = function(config, cmd) {
  config.getSite(cmd, function(site) {
    var options = {};
    if (cmd.hasOwnProperty("name")) { options.name = cmd.name; }
    if (cmd.hasOwnProperty("customDomain")) { options.customDomain = cmd.customDomain === true ? "" : cmd.customDomain; }
    if (cmd.hasOwnProperty("password")) { options.password = cmd.password === true ? "" : cmd.password; }

    site.update(options, function(err, site) {
      if (err) {
        console.log("Error updating site: " + chalk.bold(err));
        process.exit(1);
      }

      console.log("Site updated:\n  " + chalk.bold(site.url));
    });
  });
}
