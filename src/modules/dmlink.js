const Eris = require("eris");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "dmlink", async (msg, args, thread) => {
    if (! thread) return;
    if (! args[0]) return bot.createMessage(msg.channel.id, "Please provide a message ID!");
    const [dmChannel, threadMessage] = await Promise.all([
      thread.getDMChannel(),
      thread.getThreadMessageFromThread(args[0])
    ]);
    if (! threadMessage || (threadMessage.message_type !== 3 && threadMessage.message_type !== 4)) return bot.createMessage(msg.channel.id, "Message not found!");
    return bot.createMessage(msg.channel.id, `https://discord.com/channels/@me/${dmChannel.id}/${threadMessage.dm_message_id}`);
  });
};
