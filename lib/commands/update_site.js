var chalk = require("chalk");

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
    console.log("Error updating site:");
    console.log("  " + chalk.bold(err));
    process.exit(1);
  });
}
