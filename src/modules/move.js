const Eris = require("eris");
const config = require("../config");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  /**
   * @param {Eris.GuildTextableChannel} channel
   */
  async function clearThreadOverwrites(channel) {
    const overwrites = channel.permissionOverwrites;
    if (! overwrites) return;
    let promises = [];
    for (let o of overwrites.values()) {
      if (o.id === channel.guild.id) continue;
      promises.push(channel.deletePermission(o.id, "Moving modmail thread."));
    }

    return await Promise.all(promises);
  }

  /**
   * @param {Eris.GuildTextableChannel} channel
   * @param {Eris.CategoryChannel} category
   */
  function syncThreadChannel(channel, category) {
    const overwrites = category.permissionOverwrites;
    if (! overwrites) return;
    for (let o of overwrites.values()) {
      if (o.id === channel.guild.id) continue;
      channel.editPermission(o.id, o.allow, o.deny, o.type, "Moving modmail thread.");
    }
  }

  threadUtils.addInboxServerCommand(bot, "move", async (msg, args, thread) => {
    if (! config.allowMove) return;

    if (! thread) return;

    const searchStr = args[0];
    if (! searchStr || searchStr.trim() === "") return;

    // const normalizedSearchStr = transliterate.slugify(searchStr);

    /**
     * @type {Eris.CategoryChannel[]}
     */
    const categories = bot.guilds.get(msg.guildID).channels.filter(c => {
      if (config.allowedCategories && config.allowedCategories.length) {
        if (config.allowedCategories.find(id => id === c.id)) {
          return true;
        }

        return false;
      }
      // Filter to categories that are not the thread's current parent category
      return (c instanceof Eris.CategoryChannel) && (c.id !== msg.channel.parentID);
    });

    if (categories.length === 0) return;

    /**
     * @type {Eris.CategoryChannel}
     */
    const targetCategory = categories.find(c => c.name.toLowerCase() === searchStr.toLowerCase() || c.name.toLowerCase().startsWith(searchStr.toLowerCase()));
    if (! targetCategory) {
      return thread.postSystemMessage("No matching category.");
    }

    // See if any category name contains a part of the search string
    // const containsRankings = categories.map(cat => {
    //   const normalizedCatName = transliterate.slugify(cat.name);

    //   let i;
    //   for (i = 1; i < normalizedSearchStr.length; i++) {
    //     if (! normalizedCatName.includes(normalizedSearchStr.slice(0, i))) {
    //       i--;
    //       break;
    //     }
    //   }

    //   return [cat, i];
    // });

    // // Sort by best match
    // containsRankings.sort((a, b) => {
    //   return a[1] > b[1] ? -1 : 1;
    // });

    // if (containsRankings[0][1] === 0) {
    //   thread.postSystemMessage('No matching category');
    //   return;
    // }

    // const targetCategory = containsRankings[0][0];
    /**
     * @type {Eris.GuildTextableChannel}
     */
    const threadChannel = bot.guilds.get(msg.guildID).channels.get(thread.channel_id);

    await clearThreadOverwrites(threadChannel);

    bot.editChannel(thread.channel_id, {
      parentID: targetCategory.id
    }).then(() => { 
		  syncThreadChannel(threadChannel, targetCategory)
	  }).then(() => {
		  bot.createMessage(threadChannel.id, {
			  content: `<@&${config.inboxAdminRoleId}>, a thread has been moved.`,
			  allowedMentions: {
				  roles: true,
			  },
		  });
	  });

    thread.postSystemMessage(`Thread moved to ${targetCategory.name.toUpperCase()}`);
  });

  bot.registerCommandAlias("m", "move");
};
