const Eris = require("eris");
const threads = require("../data/threads");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "hide", async (msg, args, thread) => {
    if (! utils.isAdmin(msg.member)) return;
    if (! args[0]) return bot.createMessage(msg.channel.id, "Please provide a thread ID!");

    thread = await threads.findById(args[0]);

    if (! thread) return bot.createMessage(msg.channel.id, "Thread not found!");

    const suffix = msg.channel.id == thread.channel_id ? "this" : "that";
    const text = `Made ${suffix} thread`;

    if (! thread.isPrivate) {
      thread.makePrivate();
      bot.createMessage(msg.channel.id, text + " private!");
    } else {
      thread.makePublic();
      bot.createMessage(msg.channel.id, text + " public!");
    }
  });
};
