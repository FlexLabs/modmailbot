const Eris = require("eris");
const config = require("../config");
const threadUtils = require("../threadUtils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  threadUtils.addInboxServerCommand(bot, "purge", async (msg, args, thread) => {
    if (! thread) return;

    if (! config.inboxAdminRoleId) {
		return;
	}

	if (msg.member.roles && msg.member.roles.includes(config.inboxAdminRoleId)) {
		// @ts-ignore
		const channel = await thread.getDMChannel();
		if (! channel || ! channel.id) {
			return thread.postSystemMessage("Error getting DM Channel");
		}

		const msgs = await bot.getMessages(channel.id, 100);
		let messages = msgs.filter(m => m.author.id === bot.user.id).map(m => m.id);

		if (args.length > 0 && ! isNaN(Number(args[0]))) {
			messages = messages.slice(0, parseInt(args[0], 10));
		}

		if (messages && messages.length) {
			try {
				const count = messages.length;
				for (let id of messages) {
					bot.deleteMessage(channel.id, id).catch(() => null);
				}
				thread.postSystemMessage(`Purged ${count} messages.`);
			} catch (err) {
				thread.postSystemMessage(`Error deleting messages: ${err.message}`);
			}
		}
	}
  });

	bot.registerCommandAlias("p", "purge");
	
	threadUtils.addInboxServerCommand(bot, "undo", async (msg, args, thread) => {
		if (! thread) return;

		// @ts-ignore
		const channel = await thread.getDMChannel();
		if (! channel || ! channel.id) {
			return thread.postSystemMessage("Error getting DM Channel");
		}

		const messages = await bot.getMessages(channel.id, 100);
		const message = messages.filter(m => m.author.id === bot.user.id)[0];

		if (message) {
			try {
				await bot.deleteMessage(channel.id, message.id);
				thread.postSystemMessage("Purged 1 message.");
			} catch (err) {
				thread.postSystemMessage(`Error deleting messages: ${err.message}`);
			}
		}
	});
};
