const Eris = require("eris");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "modformat", async (msg, args, thread) => {
    if (! thread) return;
    const reason = args.join(" ").trim();
    if (reason) {
      bot.createMessage(msg.channel.id, `${reason} | ${thread.id}`);
    }
  });

  bot.registerCommandAlias("mf", "modformat");
};
