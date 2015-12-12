var prompt = require("prompt"),
    chalk = require("chalk"),
    site_picker = require("../helpers/site_picker");

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

var withPath = function(config, cmd, cb) {
  var path    = config.getPath(cmd);

  if (path) {
    cb(path);
  } else {
    prompt.start();
    prompt.get({name: "path", message: "Path to deploy? (current dir)"}, function(err, result) {
      if (result) {
        cb(result.path || process.cwd());
      }
    });
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
                 site_picker.pickSite(config.client, {}, cb);
               }
             });
           };

  withPath(config, cmd, function(path) {
    fn(function(err, site) {
      if (err) {
        console.log((siteId ? "Error accessing site: " : "Error creating site: ") + chalk.bold(err));
        process.exit(1);
      }
      var options = {};

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
  });
}
