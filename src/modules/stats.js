const humanizeDuration = require("humanize-duration");
const utils = require("../utils");

/** @param {import("eris").CommandClient} bot */
module.exports = (bot) => {
  bot.registerCommand("stats", (msg) => {
    if (! utils.isStaff(msg.member)) return;
    bot.createMessage(msg.channel.id,
      `Process uptime: ${humanizeDuration(process.uptime() * 1000, { largest: 2 })}\n`
      + `Bot uptime: ${humanizeDuration(bot.uptime, { largest: 2 })}\n`
      + `Memory Usage: ${process.memoryUsage().rss / 1024 / 1024}MB\nPID: ${process.pid}\nVersion: ${process.version}`
      // NOTE process.memoryUsage.rss() is in node 15.6 which is faster than process.memoryUsage().rss
    );
  });

  bot.registerCommandAlias("uptime", "stats");
  bot.registerCommandAlias("up", "stats");
};
