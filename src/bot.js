const Eris = require("eris");
const config = require("./config");

const bot = new Eris.CommandClient(`Bot ${config.token}`, {
  getAllUsers: true,
  restMode: true,
  allowedMentions: {
    everyone: false,
    users: true,
    roles: false,
  },
  intents: ["guilds", "guildMembers", "guildMessages", "guildMessageTyping", "directMessages", "directMessageTyping"] // Hopefully this is all that's needed?
}, {
  prefix: config.prefix,
  ignoreSelf: true,
  ignoreBots: true,
  defaultHelpCommand: false,
  defaultCommandOptions: {
    caseInsensitive: true,
    errorMessage: (msg, err) => {
      const { handleError } = require("./utils");

      handleError(err);
      msg.channel.createMessage("The command failed! See the logs channel for further information").catch(() => null);
    }
  },
  argsSplitter: (str) => str.split(" ")
});

module.exports = bot;