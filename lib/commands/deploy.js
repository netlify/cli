var chalk       = require("chalk"),
    inquirer    = require("inquirer"),
    when        = require("when"),
    fn          = require("when/callbacks"),
    nodefn      = require("when/node"),
    fs          = require("fs"),
    confirm     = require("../helpers/confirm"),
    site_picker = require("../helpers/site_picker"),
    errorLogger = require("../helpers/error_logger");


var spinner = [
  "/ Processing",
  "| Processing",
  "\\ Processing",
  "- Processing"
];

/* Warnings about typical gotchas for deploying the root dir */
var fileChecksCWD = {
  "_config.yml":
    "It looks like this folder is a Jekyll site, but you're deploying the root\n" +
    "directory directly.\n" +
    "Unless this is what you intend to do, you might want to run " + chalk.bold("jekyll build") + " and\n" +
    "deploy the " + chalk.bold("_site") + " folder.",
  "node_modules":
    "It looks like there's a node_modules folder in the directory you're deploying.\n" +
    "Try to avoid deploying all your node dependencies since most of these will be\n" +
    "server-side libraries, and instead use a build tool to copy just the relevant\n" +
    "files into a folder that only has front-end libraries.",
  "Gruntfile.js":
    "It looks like this is a Grunt based project, but you're deploying the root\n" +
    "directory directly.\n" +
    "Unless this is what you intend to do, you might want to run " + chalk.bold("grunt build") + " and\n" +
    "deploy the " + chalk.bold("dist") + " folder.",
  "gulpfile.js":
    "It looks like this is a Gulp based project, but you're deploying the root\n" +
    "directory directly.\n" +
    "Unless this is what you intend to do, you might want to run " + chalk.bold("gulp build") + " and\n" +
    "deploy the " + chalk.bold("dist") + " folder."
};

function withPath(config, cmd) {
  var path    = config.getPath(cmd);

  if (path) {
    return when.resolve(path);
  } else {
    return fn.call(inquirer.prompt, {name: "path", message: "Path to deploy? (current dir)"}).then(function(result) {
      return result.path || process.cwd();
    });
  }
}

function sanityCheck(config) {
  return function(path) {
    if (!config.existing && path == process.cwd()) {
      for (var file in fileChecksCWD) {
        if (fs.existsSync(file)) {
          return confirm.withWarning(path, fileChecksCWD[file]);
        }
      }
    }
    return when.resolve(path);
  }
}

exports.cmd = function(config, cmd) {
  var siteId     = config.getSiteId(cmd),
      sitePromise = null;

  if (siteId) {
    sitePromise = config.client.site(siteId);
  } else {
    sitePromise = fn.call(inquirer.prompt, [{name: "confirm", type: "confirm", message: "No site id specified, create a new site"}]).then(function(result) {
      if (result.confirm) { return config.client.createSite({}); }
      return site_picker.pickSite(config.client, {});
    });
  }

  sitePromise.then(function(site) {
    return withPath(config, cmd).then(sanityCheck(config)).then(function(path) {
      var options = {};
      var ui = null;
      var uploaded = 0;

      ui = new inquirer.ui.BottomBar();

      options.draft = cmd.draft;
      options[path.match(/\.zip$/) ? 'zip' : 'dir'] = path;

      options.progress = function(event, data) {
        if (ui == null) {
          return;
        }
        if (event == 'start' && data.total) {
          ui && ui.updateBottomBar("[                                        ] Uploading");
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
            console.log("\nDeploy is live (permalink):\n  " + chalk.bold(deploy.deploy_url));
            console.log("\nLast build is always accessible on " + chalk.bold(deploy.url));
            process.exit(0);
          }
        });
      });
    });
  }).catch(function(err) {
    errorLogger.log("Error during deploy: ", err);
    process.exit(1);
  });
}
