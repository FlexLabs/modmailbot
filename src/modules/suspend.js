const Eris = require("eris");
const threads = require("../data/threads");
const threadUtils = require("../utils/threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "suspend", async (msg, args, thread) => {
    if (! thread) return;
    await thread.suspend();
    thread.postSystemMessage("**Thread suspended!** This thread will act as closed until unsuspended with `!unsuspend`");
  });

  threadUtils.addInboxServerCommand(bot, "unsuspend", async msg => {
    const thread = await threads.findSuspendedThreadByChannelId(msg.channel.id);
    if (! thread) return;

    const otherOpenThread = await threads.findOpenThreadByUserId(thread.user_id);
    if (otherOpenThread) {
      thread.postSystemMessage(`Cannot unsuspend; there is another open thread with this user: <#${otherOpenThread.channel_id}>`);
      return;
    }

    await thread.unsuspend();
    thread.postSystemMessage("**Thread unsuspended!**");
  });
};
