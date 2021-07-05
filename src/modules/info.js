const Eris = require("eris");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "info", async (msg, args, thread) => {
    if (! thread) return;

    await thread.sendThreadInfo();
  });
};
