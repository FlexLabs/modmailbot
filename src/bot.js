const Eris = require("eris");
const config = require("./config");

const bot = new Eris.CommandClient(config.token, {
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
  },
});

module.exports = bot;
