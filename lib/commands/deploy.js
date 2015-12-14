var chalk       = require("chalk"),
    inquirer    = require("inquirer"),
    when        = require("when"),
    fn          = require("when/callbacks"),
    nodefn      = require("when/node"),
    site_picker = require("../helpers/site_picker");

var spinner = [
  "/ Processing",
  "| Processing",
  "\\ Processing",
  "- Processing"
];

var withPath = function(config, cmd) {
  var path    = config.getPath(cmd);

  if (path) {
    return when.resolve(path);
  } else {
    return fn.call(inquirer.prompt, {name: "path", message: "Path to deploy? (current dir)"}).then(function(result) {
      return result.path || process.cwd();
    });
  }
}

exports.cmd = function(config, cmd) {
  var siteId     = config.getSiteId(cmd),
      siePromise = null;

  if (siteId) {
    sitePromise = config.client.site(siteId);
  } else {
    sitePromise = fn.call(inquirer.prompt, [{name: "confirm", type: "confirm", message: "No site id specified, create a new site"}]).then(function(result) {
      if (result.confirm) { return config.client.createSite({}); }
      return site_picker.pickSite(config.client, {});
    });
  }

  sitePromise.then(function(site) {
    withPath(config, cmd).then(function(path) {
      var options = {};
      var ui = null;
      var uploaded = 0;

      ui = new inquirer.ui.BottomBar({bottomBar: ""});

      options.draft = cmd.draft;
      options[path.match(/\.zip$/) ? 'zip' : 'dir'] = path;

      options.progress = function(event, data) {
        if (ui == null) {
          return;
        }
        if (event == 'start' && data.total) {
          ui.updateBottomBar({ bottomBar: "[                                        ] Uploading" });
        }
        if (event == 'upload') {
            uploaded++;
            var progress = "[";
            for (var i=0; i<40; i++) {
              if (i<=40*uploaded/data.total) {
                progress += "=";
              } else {
                progress += " ";
              }
            }
            progress += "] Uploading";
            ui.updateBottomBar( progress );
        }
      }

      console.log("Deploying " + (options.dir ? "folder: " : "zip: ") + chalk.bold(path));
      return site.createDeploy(options).then(function(deploy) {
        config.writeLocalConfig({site_id: site.id, path: path});

        if (ui && uploaded > 1) {
          ui && ui.updateBottomBar("[========================================] Uploading");
        }
        if (ui) {
          var i = 0;
          var spin = setInterval(function() {
            ui.updateBottomBar( spinner[i++ % 4] );
          }, 300);
        }
        return deploy.waitForReady().then(function(deploy) {
          if (ui) {
            ui.updateBottomBar("");
            clearInterval(spin);
          }
          if (cmd.draft) {
            console.log("\nDraft deploy " + chalk.bold(deploy.id) + ":\n  " + chalk.bold(deploy.deploy_url));
            process.exit(0);
          } else {
            console.log("\nDeploy is live:\n  " + chalk.bold(deploy.url));
            process.exit(0);
          }
        });
      });
    });
  }).catch(function(err) {
    console.log("Error during deploy: " + chalk.bold(err));
    process.exit(1);
  });
}
