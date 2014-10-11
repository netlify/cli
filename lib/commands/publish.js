var chalk = require("chalk");

exports.cmd = function(config, deployId, cmd) {
  config.getSite(cmd, function(site) {
    site.deploy(deployId, function(err, deploy) {
      if (err) {
        console.log("Error fetching deploy: " + chalk.bold(err));
        process.exit(1);
      }

      deploy.publish(function(err, deploy) {
        if (err) {
          console.log("Error publishing deploy: " + chalk.bold(err));
          process.exit(1);
        }

        console.log("Deploy is now live:\n  " + chalk.bold(site.url));
      });
    });
  });
}
