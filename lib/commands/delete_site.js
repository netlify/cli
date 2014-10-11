var yesno = require("yesno"),
    chalk = require("chalk");

var withConfirmation = function(cmd, cb) {
  if (cmd.yes) {
    cb()
  } else {
    yesno.ask('Are you sure you want to delete this site?', true, function(ok) {
      if(ok) {

      } else {

      }
    });
  }
}

exports.cmd = function(config, cmd) {
  var siteId = cmd.siteId || config.siteId;
  if (siteId == null) {
    console.log("No site id specified");
    process.exit(1);
  }

  config.client.site(config.getSiteId(siteId), function(err, site) {
    if (err) {
      console.log("Site not found: " + chalk.bold(err));
      process.exit(1);
    }

    site.destroy(function(err) {
      if (err) {
        console.log("Error deleting site: " + chalk.bold(err));
        process.exit(1);
      }

      console.log("Site deleted");
      config.deleteLocalConfig();
    });
  });
}
