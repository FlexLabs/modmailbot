const Eris = require("eris");
const config = require("../config");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  // Mods can reply to modmail threads using !r or !reply
  // These messages get relayed back to the DM thread between the bot and the user
  if (config.dataFactory) {
    const tags = require("../data/tags");
    threadUtils.addInboxServerCommand(bot, "tag", async (msg, args, thread) => {
      if (! thread) return;

      const tag = args.join(" ").trim();
      if (! tag) return;
      let isAnonymous = false;

      if (config.replyAnonDefault === true) {
        isAnonymous = true;
      }

      const resolvedTag = await tags.getTag(msg.channel.guild.id, tag);
      if (! resolvedTag) return;

      await thread.replyToUser(msg.member, resolvedTag.content, [], isAnonymous);
      msg.delete();
    });

    bot.registerCommandAlias("t", "tag");
  }
};
