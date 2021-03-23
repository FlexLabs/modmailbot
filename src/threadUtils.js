const threads = require("./data/threads");
const utils = require("./utils");
const Eris = require("eris");
const Thread = require("./data/Thread"); // eslint-disable-line no-unused-vars

/**
 * Adds a command that can only be triggered on the inbox server.
 * Command handlers added with this function also get the thread the message was posted in as a third argument, if any.
 * @param {Eris.CommandClient} bot
 * @param {String} cmd
 * @param {(msg: Eris.Message<Eris.GuildTextableChannel>, args: string[], thread: Thread) => void} commandHandler
 * @param {Eris.CommandOptions} [opts]
 */
function addInboxServerCommand(bot, cmd, commandHandler, opts) {
  try {
    bot.registerCommand(cmd, async (msg, args) => {
      if (! (await utils.messageIsOnInboxServer(msg))) return;
      if (! utils.isStaff(msg.member)) return;

      const thread = await threads.findOpenThreadByChannelId(msg.channel.id);
      commandHandler(msg, args, thread);
    }, opts);
  } catch (error) {
    utils.handleError(error);
  }
}

module.exports = {
  addInboxServerCommand
};
