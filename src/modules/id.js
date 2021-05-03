const Eris = require("eris");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "id", async (msg, args, thread) => {
    if (! thread) return;
    bot.createMessage(msg.channel.id, `${thread.user_id}`);
  });
};
