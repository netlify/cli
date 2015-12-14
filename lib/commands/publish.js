var chalk = require("chalk");

exports.cmd = function(config, deployId, cmd) {
  config.getSite(cmd).then(function(site) {
    site.deploy(deployId).then(function(deploy) {
      deploy.publish().then(function(deploy) {
        console.log("Deploy is now live:\n  " + chalk.bold(site.url));
      });
    });
  }).catch(function(err) {
    console.log("Error publishing deploy: " + chalk.bold(err));
    process.exit(1);
  });
}
