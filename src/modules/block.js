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
    if (! userId) return utils.postError(thread, "Please provide a user mention or ID!", null, msg);

    let user = bot.users.get(userId);
    if (! user) {
      user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postError(thread, "I can't find that user!", null, msg);
    }

    const isBlocked = await blocked.isBlocked(user.id);
    if (isBlocked) return utils.postError(thread, `${user.username} is already blocked!`, null, msg);

    const reason = args.join(" ").trim();

    if (thread) {
      let text = `You have been blocked from modmail${reason ? ` for: ${reason}` : "."}`;
      if (msg.attachments.length) await attachments.saveAttachmentsInMessage(msg);
      await thread.replyToUser(msg.member, text, msg.attachments, config.replyAnonDefault);
    }

    await blocked.block(user.id, `${user.username}`, msg.author.id)
      .then(() => {
        blocked.logBlock(user, msg.member, reason);
        utils.postSuccess(thread, `***${user.username} has been blocked from modmail!***`, null, msg);
      });
  });

  threadUtils.addInboxServerCommand(bot, "unblock", async (msg, args, thread) => {
    const userId = (thread && thread.user_id) || utils.getUserMention(args.shift());
    if (! userId) return utils.postError(thread, "Please provide a user mention or ID!", null, msg);

    let user = bot.users.get(userId);
    if (! user) {
      user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postError(thread, "I can't find that user!", null, msg);
    }

    const isBlocked = await blocked.isBlocked(user.id);
    if (! isBlocked) return utils.postError(thread, `${user.username} is not blocked from modmail!`, null, msg);

    let reason = args.join(" ").trim();

    await blocked.unblock(userId)
      .then(() => {
        blocked.logBlock(user, msg.member, reason, true);
        utils.postSuccess(thread, `***${user.username} has been unblocked from modmail!***`, null, msg);
      });
  });
};
