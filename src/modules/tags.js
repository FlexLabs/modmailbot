const tags = require('../data/tags');
const config = require('../config');
const utils = require('../utils');
const threadUtils = require('../threadUtils');

module.exports = bot => {
  const addInboxServerCommand = (...args) => threadUtils.addInboxServerCommand(bot, ...args);

  // Mods can reply to modmail threads using !r or !reply
  // These messages get relayed back to the DM thread between the bot and the user
  addInboxServerCommand('tag', async (msg, args, thread) => {
    if (! thread) return;

    const tag = args.join(' ').trim();
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

  bot.registerCommandAlias('t', 'tag');
};
