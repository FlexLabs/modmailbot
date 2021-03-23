const Eris = require("eris");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "dmlink", async (msg, args, thread) => {
    if (! thread) return;
    if (! args[0]) return "Provide a message ID";
    const [dmChannel, threadMessage] = await Promise.all([
      bot.getDMChannel(thread.user_id),
      thread.getThreadMessageFromThread(args[0])
    ]);
    if (! threadMessage) return msg.channel.createMessage("Message not found");
    return msg.channel.createMessage(`https://discord.com/channels/@me/${dmChannel.id}/${threadMessage.dm_message_id}`);
  });
};