const Eris = require("eris");
const utils = require("../utils");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "alert", async (msg, args, thread) => {
    if (! thread) return;

    const status = thread.alert_users && thread.alert_users.includes(msg.member.id);

    await thread.alertStatus(msg.member.id, ! status);

    if (! status) {
      utils.postSystemMessageWithFallback(msg.channel, thread,
        `I'll mention you whenever **${thread.user_name}** sends a new message.`
      );
    } else {
      utils.postSystemMessageWithFallback(msg.channel, thread,
        "I won't give you new message alerts for this thread anymore."
      );
    }
  });
};
