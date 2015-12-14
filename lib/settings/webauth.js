var when  = require("when"),
    chalk = require("chalk"),
    webui = require("../helpers/webui");

function waitForTicket(ticket, waitUntil) {
  if (waitUntil && new Date() > waitUntil) {
    return when.reject("Timeout while waiting for ticket grant");
  }

  if (ticket.authorized) {
    return when.resolve(ticket);
  } else {
    return when.resolve().delay(500).then(ticket.refresh.bind(ticket)).then(function(ticket) {
      return waitForTicket(ticket, waitUntil);
    });
  }
};

exports.login = function(options) {
  return options.client.createTicket().then(function(ticket) {
    return webui.open("/authorize?response_type=ticket&ticket=" + ticket.id).then(function() {
      var ts = new Date();
      ts.setHours(ts.getHours() + 1);
      return waitForTicket(ticket, ts).then(function(ticket) {
        return ticket.exchange();
      });
    });
  }).catch(function(err) {
    console.log("Error generating authorization ticket: %s", err);
    process.exit(1);
  });
}
