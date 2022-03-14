const Eris = require("eris");
const attachments = require("../data/attachments");
const blocked = require("../data/blocked");
const config = require("../config");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "block", async (msg, args, thread) => {
    const userId = (thread && thread.user_id) || utils.getUserMention(args.shift());
    if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

    let user = bot.users.get(userId);
    if (! user) {
      user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");
    }

    const isBlocked = await blocked.isBlocked(user.id);
    if (isBlocked) return utils.postSystemMessageWithFallback(msg.channel, thread, `${user.username}#${user.discriminator} is already blocked!`);

    const reason = args.join(" ").trim();

    if (thread) {
      let text = `You have been blocked${reason ? ` for ${reason}` : "."}`;
      if (msg.attachments.length) await attachments.saveAttachmentsInMessage(msg);
      await thread.replyToUser(msg.member, text, msg.attachments, config.replyAnonDefault);
    }

    await blocked.block(user.id, `${user.username}#${user.discriminator}`, msg.author.id)
      .then(() => {
        blocked.logBlock(user, msg.member, reason);
        utils.postSystemMessageWithFallback(msg.channel, thread, `Blocked <@${user.id}> (${user.id}) from modmail!`);
      });
  });

  threadUtils.addInboxServerCommand(bot, "unblock", async (msg, args, thread) => {
    const userId = (thread && thread.user_id) || utils.getUserMention(args.shift());
    if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

    let user = bot.users.get(userId);
    if (! user) {
      user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");
    }

    const isBlocked = await blocked.isBlocked(user.id);
    if (! isBlocked) return utils.postSystemMessageWithFallback(msg.channel, thread, `${user.username}#${user.discriminator} isn't blocked!`);

    let reason = args.join(" ").trim();

    await blocked.unblock(userId)
      .then(() => {
        blocked.logBlock(user, msg.member, reason, true);
        utils.postSystemMessageWithFallback(msg.channel, thread, `Unblocked <@${userId}> (${userId}) from modmail!`);
      });
  });
};
