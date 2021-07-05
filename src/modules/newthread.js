const Eris = require("eris");
const SSE = require("express-sse");
const utils = require("../utils");
const threadUtils = require("../threadUtils");
const threads = require("../data/threads");

/**
 * @param {Eris.CommandClient} bot
 * @param {SSE} sse
 */
module.exports = (bot, sse) => {
  threadUtils.addInboxServerCommand(bot, "newthread", async (msg, args, thread) => {
    const userId = utils.getUserMention(args[0]);
    if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

    const user = bot.users.get(userId);
    if (! user) {
      utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");
      return;
    }

    const existingThread = await threads.findOpenThreadByUserId(user.id);
    if (existingThread) {
      let channel = msg.channel.guild.channels.get(existingThread.channel_id);
      let str = "there is another open thread with this user";

      if (channel) {
        if (channel.permissionsOf(msg.member.id).has("viewChannel")) {
          str += `: <#${channel.id}>`;
        } else {
          const parent = msg.channel.guild.channels.get(channel.parentID);
          str += parent ? ` in the **${parent.name}** category` : " in a hidden channel";
        }
      } else {
        str += `: <#${existingThread.channel_id}>`;
      }

      utils.postSystemMessageWithFallback(msg.channel, thread, `Cannot create a new thread; ${str}.`);
      return;
    }

    const createdThread = await threads.createNewThreadForUser(user, true);
    createdThread.postSystemMessage(`Thread was opened by ${msg.author.username}#${msg.author.discriminator}`);

    sse.send({ thread: createdThread }, "threadOpen", null);

    if (thread) {
      msg.delete();
    }
  });
};
