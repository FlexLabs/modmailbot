const threadUtils = require("../threadUtils");

module.exports = bot => {
  const addInboxServerCommand = (...args) => threadUtils.addInboxServerCommand(bot, ...args);

  addInboxServerCommand('ping', async (msg) => {
    const start = Date.now();
    const message = await msg.channel.createMessage('Pong!');
    message.edit(`Pong! \`${Date.now() - start}ms\``);
  });
};
