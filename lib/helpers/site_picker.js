var chalk = require("chalk"),
    inquirer = require("inquirer");

function pick(client, options, cb) {
  var params = {page: options.page, per_page: options.per_page};
  if (options.guest) {
    params.params = {guest: true};
  }
  client.sites(params, function(err, sites) {
    if (err) {
      return console.log("Error listing sites: ", err);
    }
    if (sites.length === 0) {
      console.log("No sites to list");
      process.exit(0);
    }
    var choices = sites.map(function(site) {
      return {
        name: chalk.bold(site.name) + ": " + site.url,
        value: {type: "site", site: site}
      }
    });
    if (sites.meta.pagination.next) {
      choices.push({
        name: "Page "+ sites.meta.pagination.next,
        value: {type: "page", value: sites.meta.pagination.next}
      });
      choices.push(new inquirer.Separator());
    }
    var message = chalk.bold("Your Sites");
    if (sites.meta.pagination.next) {
      message += " (Page" + options.page + " of " + sites.meta.pagination.last + ")";
    }
    inquirer.prompt([{
      type: "list",
      name: "action",
      message: message,
      choices: choices
    }], function(answers) {
      if (answers.action.type == "site") {
        cb(null, answers.action.site);
      }
      if (answers.action.type == "page") {
        pick(client, {page: options.page + 1, per_page: options.per_page}, cb);
      }
    });
  });
}

exports.pickSite = function(client, options, cb) {
  options = options || {};
  options.page = 1;
  options.per_page = options.per_page || 10;
  return pick(client, options, cb);
}
