const humanizeDuration = require("humanize-duration");
const utils = require("../utils/utils");

/** @param {import("eris").CommandClient} bot */
module.exports = (bot) => {
  bot.registerCommand("stats", (msg) => {
    if (! utils.isAllowed(msg.member)) return;
    bot.createMessage(msg.channel.id, {
      embeds: [{
        description: `**Version:** ${process.version}\n**Memory Usage:** ${(process.memoryUsage.rss() / 1024 / 1024).toFixed(2)}MB\n`
      + `**Bot Uptime:** ${humanizeDuration(bot.uptime, { largest: 2, round: true })}\n`
      + `**Process Uptime:** ${humanizeDuration(process.uptime() * 1000, { largest: 2, round: true })}`,
        footer: { text: `PID ${process.pid} | Dave` }
      }]
    });
  });

  bot.registerCommandAlias("uptime", "stats");
  bot.registerCommandAlias("up", "stats");
};
