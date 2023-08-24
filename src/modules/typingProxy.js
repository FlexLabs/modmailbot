const Eris = require("eris");
const config = require("../config");
const threads = require("../data/threads");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  // Typing proxy: forwarding typing events between the DM and the modmail thread
  if (config.typingProxy || config.typingProxyReverse) {
    bot.on("typingStart", async (channel, user) => {
      if (config.typingProxy && ! channel.guild) {
        const mailGuild = bot.guilds.get(config.mailGuildId);
        const foundUser = mailGuild && mailGuild.channels.find((c) => c.name.startsWith(user.username));
        if (! foundUser) return;

        const thread = await threads.findOpenThreadByUserId(user.id);
        if (! thread) return;

        await bot.sendChannelTyping(thread.channel_id)
          .catch(() => null);
      } else if (config.typingProxyReverse && channel.type === 0 && ! user.bot) {
        const thread = await threads.findByChannelId(channel.id);
        if (! thread) return;

        const dmChannel = await thread.getDMChannel();
        if (! dmChannel) return;

        await bot.sendChannelTyping(dmChannel.id)
          .catch(() => null);
      }
    });
  }
};
