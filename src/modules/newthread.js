const Eris = require("eris");
const SSE = require("express-sse");
const threads = require("../data/threads");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");

/**
 * @param {Eris.CommandClient} bot
 * @param {SSE} sse
 */
module.exports = (bot, sse) => {
  threadUtils.addInboxServerCommand(bot, "newthread", async (msg, args, thread) => {
    const userId = utils.getUserMention(args[0]);
    if (! userId) return utils.postError(thread, "Please provide a user mention or ID!", null, msg);

    const user = bot.users.get(userId);
    if (! user) {
      utils.postError(thread, "I can't find that user!", null, msg);
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

      utils.postError(thread, `Cannot create a new thread; ${str}.`, null, msg);
      return;
    }

    const createdThread = await threads.createNewThreadForUser(user, null, true);
    utils.postInfo(createdThread, `Thread was opened by ${msg.author.username}`, null, msg);
    msg.addReaction(":dynoSuccess:696561641227288639");

    sse.send({ thread: createdThread }, "threadOpen", null);

    if (thread) {
      msg.delete();
    }
  });
};
