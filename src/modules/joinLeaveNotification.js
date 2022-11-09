const Eris = require("eris");
const config = require("../../config2.json");
const threads = require("../data/threads");
const utils = require("../utils/utils");
const {internalClose} = require("../utils/components");

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
    const cat = guild.channels.get(config.modmailCategories.modmail.id);
    if (cat.channels.size <= 2) return;

    let thread = await threads.findOpenThreadByUserId(member.id);
    if (thread !== null) {
      return await thread.postSystemMessage("**The user has re-joined the server.**");
    }
  });

  // Leave Notification: Post a message in the thread if the user leaves main server
  bot.on("guildMemberRemove", async (guild, member) => {
    if (guild.id !== (await utils.getMainGuild()).id) return;


    // Attempt to limit database calls by checking if there are existing modmail channels.
    /**
        * @type {Eris.CategoryChannel}
        */
    const cat = await guild.channels.get(config.modmailCategories.modmail.id);
    if (cat.channels.size <= 2) return;

    let thread = await threads.findOpenThreadByUserId(member.id);
    if (thread !== null) {
      const leaveNotice = {
        content: `**The user has left the server.**\nUserID: ${member.id}`,
        components: internalClose,
      };

      return await thread.postSystemMessage(leaveNotice, true);
    }
  });
};
