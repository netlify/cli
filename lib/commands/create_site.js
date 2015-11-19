var chalk = require("chalk");

exports.cmd = function(config, cmd) {
  var options = {};
  options.name = cmd.name
  options.customDomain = cmd.customDomain
  options.password = cmd.password
  console.log("Creating new site");
  config.client.createSite(options, function(err, site) {
    if (err) {
      console.log("Error creating site: " + chalk.bold(err));
      process.exit(1);
    }
    console.log("Site created: " + chalk.bold(site.admin_url));
    config.writeLocalConfig({site_id: site.id});
  });
}
