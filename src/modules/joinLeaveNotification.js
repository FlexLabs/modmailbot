const Eris = require("eris");
const config = require("../../config2.json");
const threads = require("../data/threads");
const utils = require("../utils/utils");
const {internalLeave} = require("../utils/components");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {

  // Join Notification: Post a message in the thread if the user joins main server
  bot.on("guildMemberAdd", async (guild, member) => {
    if (guild.id !== (await utils.getMainGuild()).id) return;

    // Attempt to limit database calls by checking if there are existing modmail channels.
    /**
     * @type {Eris.CategoryChannel}
     */
    const mainCat = guild.channels.get(config.newThreadCategoryId);
    const supportCat = guild.channels.get(config.supportThreadCategoryId);
    const adminCat = guild.channels.get(config.adminThreadCategoryId);
    if (mainCat.channels.size <= 2 && supportCat.channels.size <= 1 && adminCat.channels.size <= 1) return;

    let thread = await threads.findOpenThreadByUserId(member.id);
    if (thread !== null) {
      return utils.postInfo(thread, "**User has joined the server.**");
    }
  });

  // Leave Notification: Post a message in the thread if the user leaves main server
  bot.on("guildMemberRemove", async (guild, member) => {
    if (guild.id !== (await utils.getMainGuild()).id) return;


    // Attempt to limit database calls by checking if there are existing modmail channels.
    /**
     * @type {Eris.CategoryChannel}
     */
    const mainCat = guild.channels.get(config.newThreadCategoryId);
    const supportCat = guild.channels.get(config.supportThreadCategoryId);
    const adminCat = guild.channels.get(config.adminThreadCategoryId);
    if (mainCat.channels.size <= 2 && supportCat.channels.size <= 1 && adminCat.channels.size <= 1) return;

    let thread = await threads.findOpenThreadByUserId(member.id);
    if (thread !== null) {
      return utils.postInfo(thread, "**User has left the server.**", internalLeave);
    }
  });
};
