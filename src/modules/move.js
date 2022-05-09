const Eris = require("eris");
const config = require("../config");
const threads = require("../data/threads");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "move", async (msg, args, thread) => {
    if (! config.allowMove) return;
    if (! thread) return;

    const searchStr = args[0];
    if (! searchStr || searchStr.trim() === "") return;

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
    const targetCategory = categories.find(c =>
      c.id == searchStr ||
      c.name.toLowerCase() === searchStr.toLowerCase() ||
      c.name.toLowerCase().startsWith(searchStr.toLowerCase())
    );

    if (! targetCategory) {
      return thread.postSystemMessage("No matching category.");
    }

    try {
      if(targetCategory.id == config.communityThreadCategoryId) {
        //checks if user is admin to be able move to CT branch
        if(utils.isAdmin(msg.member)){
          return threads.moveThread(thread, targetCategory, false);
        } else {
          thread.postSystemMessage("Only admins are allowed to move threads to this category");
        }
      } else {
        threads.moveThread(thread, targetCategory, ! utils.isAdmin(msg.member));
      }
    } catch (err) {
      utils.handleError(err);
      return thread.postSystemMessage("Something went wrong while trying to move this thread.");
    }
  });

  bot.registerCommandAlias("m", "move");
};
