const Eris = require("eris");
const threadUtils = require("../threadUtils");
const attachments = require("../data/attachments");
const blocked = require("../data/blocked");
const config = require("../config");
const utils = require("../utils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  const addInboxServerCommand = (...args) => threadUtils.addInboxServerCommand(bot, ...args);

  addInboxServerCommand("block", async (msg, args, thread) => {
    /**
     * @param {String} userId 
     */
    async function block(user) {
      await blocked.block(user.id, `${user.username}#${user.discriminator}`, msg.author.id);
      msg.channel.createMessage(`Blocked <@${user.id}> (id ${user.id}) from modmail`);
    }

    let logText = `**Blocked:** `;

    if (! thread && args.length > 0) {
      // User mention/id as argument
      const userId = utils.getUserMention(args.shift());
      if (! userId) return;

      const user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");

      const reason = args.join(" ").trim();

      logText += `${user.username}#${user.discriminator} (${userId}) was blocked`;

      if (reason && reason.length) {
        logText += ` for ${reason}`;
      }

      utils.postLog(logText);

      block(user);
    } else if (thread) {
      const user = await bot.getRESTUser(thread.user_id);
      const reason = args.join(" ").trim();
      let isAnonymous = false;

      if (config.replyAnonDefault === true) {
        isAnonymous = true;
      }

      let text = "You have been blocked.";

      logText += `${thread.user_name} (${thread.user_id}) was blocked`;

      if (reason && reason.length) {
        text = `You have been blocked for ${reason}`;
        logText += ` for ${reason}`;
      }

      if (msg.attachments.length) await attachments.saveAttachmentsInMessage(msg);
      await thread.replyToUser(msg.member, text, msg.attachments, isAnonymous);

      utils.postLog(logText);

      // Calling !block without args in a modmail thread blocks the user of that thread
      block(user);
    }
  });

  addInboxServerCommand("unblock", async (msg, args, thread) => {
    async function unblock(userId) {
      await blocked.unblock(userId);
      msg.channel.createMessage(`Unblocked <@${userId}> (id ${userId}) from modmail`);
    }

    let logText = `**Unblocked:** `;

    if (! thread && args.length > 0) {
      // User mention/id as argument
      const userId = utils.getUserMention(args.shift());
      if (! userId) return;

      const user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");

      const reason = args.join(" ").trim();

      logText += `${user.username}#${user.discriminator} (${userId}) was unblocked`;


      if (reason && reason.length) {
        logText += ` for ${reason}`;
      }

      utils.postLog(logText);

      unblock(userId);
    } else if (thread) {
      const reason = args.join(" ").trim();

      logText += `${thread.user_name} (${thread.user_id}) was unblocked`;

      if (reason && reason.length) {
        logText += ` for ${reason}`;
      }

      utils.postLog(logText);

      // Calling !unblock without args in a modmail thread unblocks the user of that thread
      unblock(thread.user_id);
    }
  });
};
