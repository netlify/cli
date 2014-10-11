var prompt = require("prompt"),
    chalk = require("chalk");

var createSitePrompt = {
  properties: {
    createSite: {
      type: "string",
      description: "No site id specified, create a new site (yes/no)?",
      pattern: /^yes|no$/,
      message: "Please answer yes or no",
      required: true,
      default: "yes"
    }
  }
}

exports.cmd = function(config, cmd) {
  var siteId = config.getSiteId(cmd);

  var fn = siteId ?
           function(cb) { config.client.site(siteId, cb); } :
           function(cb) {
             prompt.start()
             prompt.get(createSitePrompt, function(err, result) {
               if (result && result.createSite == "yes") {
                 config.client.createSite({}, cb);
               } else {
                 process.exit(1);
               }
             });
           };

  fn(function(err, site) {
    if (err) {
      console.log((siteId ? "Error accessing site: " : "Error creating site: ") + chalk.bold(err));
      process.exit(1);
    }
    var path    = config.getPath(cmd),
        options = {};

    options.draft = cmd.draft;
    options[path.match(/\.zip$/) ? 'zip' : 'dir'] = path;

    console.log("Deploying " + (options.dir ? "folder: " : "zip: ") + chalk.bold(path));
    site.createDeploy(options, function(err, deploy) {
      if (err) {
        console.log("Error creating deploy: " + chalk.bold(err));
        process.exit(1);
      }

      config.writeLocalConfig({site_id: site.id, path: path});

      console.log("Deploy created, waiting for processing");
      deploy.waitForReady(function(err, deploy) {
        if (err) {
          console.log("Error processing deploy: " + chalk.bold(err));
          process.exit(1);
        }

        if (cmd.draft) {
          console.log("Draft deploy " + chalk.bold(deploy.id) + ":\n  " + chalk.bold(deploy.deploy_url));
        } else {
          console.log("Deploy is live:\n  " + chalk.bold(deploy.url));
        }

      });
    });
  });
}
