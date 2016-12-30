var chalk       = require("chalk"),
    inquirer    = require("inquirer"),
    when        = require("when"),
    fn          = require("when/callbacks"),
    fs          = require("fs"),
    confirm     = require("../helpers/confirm"),
    site_picker = require("../helpers/site_picker"),
    errorLogger = require("../helpers/error_logger");

exports.cmd = function(config, cmd) {
    var siteId      = config.getSiteId(cmd),
        sitePromise = null,
        file        = cmd.file;

    if (siteId) {
        sitePromise = config.client.site(siteId);
    } else {
        sitePromise = site_picker.pickSite(config.client, {});
    }

    sitePromise
        .then(function(site) {
            const envVars = site.build_settings.env;
            const envContents = Object.keys(envVars).map(function(key) {
                return key + '="' + envVars[key] + '"';
            }).join('\n');

            if(file) {
                fs.writeFile(file, envContents, function(err) {
                    if(err) {
                        console.error("Could not save file.");
                        process.exit(1);
                    } else {
                        console.log("Saved to " + chalk.bold(file));
                        process.exit(0);
                    }
                });
            } else {
                console.log(envContents);
                process.exit(0);
            }
        });
};