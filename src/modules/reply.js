const Eris = require("eris");
const SSE = require("express-sse");
const config = require("../config");
const attachments = require("../data/attachments");
const threadUtils = require("../utils/threadUtils");

/**
 * @param {Eris.CommandClient} bot
 * @param {SSE} sse
 */
module.exports = (bot, sse) => {
  // Mods can reply to modmail threads using !r or !reply
  // These messages get relayed back to the DM thread between the bot and the user
  threadUtils.addInboxServerCommand(bot, "reply", async (msg, args, thread) => {
    if (! thread) return;

    const text = args.join(" ").trim();

    if (msg.attachments.length) await attachments.saveAttachmentsInMessage(msg);
    await thread.replyToUser(msg.member, text, msg.attachments, config.replyAnonDefault, sse);
    msg.delete();
  });

  bot.registerCommandAlias("r", "reply");

  // Anonymous replies only show the role, not the username
  threadUtils.addInboxServerCommand(bot, "anonreply", async (msg, args, thread) => {
    if (! thread) return;

    const text = args.join(" ").trim();
    if (msg.attachments.length) await attachments.saveAttachmentsInMessage(msg);
    await thread.replyToUser(msg.member, text, msg.attachments, true, sse);
    msg.delete();
  });

  bot.registerCommandAlias("ar", "anonreply");
};
