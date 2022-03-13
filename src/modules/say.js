const Eris = require("eris");
const utils = require("../utils/utils");
const randoms = [
  "You expect me to guess what you want me to say?",
  "Give me something to repeat...",
  "What do you want me to say??",
  "I can't read minds, tell me what you want me to say!",
  "You forgot to tell me what you want me to say...",
  "Say what??",
  "Cannot compute, missing arguments [0]. Restarting bot & reloading all services, please wait...",
  "Hi, I'm Dave.",
  "This guy doesn't even know how to use a say command.",
  "It'd be great if you told me what to say.",
  "Hey, I've got no clue what you want me to say, so I'll just say bananas. BANANAS.",
  "Sorry, I didn't quite catch that. Please try repeating your command, but use it properly next time.",
  "I can't repeat what you say if you don't say anything!",
  "If you're going to force me to talk, the least you could do is give me something to say...",
  "Do you want to be banned? Tell me what to say. Now.",
  "I haven't got all day, use the command properly please.",
  "Soooo, this is awkward, but what did you want me to say?",
  "NEVER GONNA GIVE YOU UP",
  "NEVER GONNA LET YOU DOWN",
  "NEVER GONNA RUN AROUND AND DESERT YOU",
  "NEVER GONNA MAKE YOU CRY",
  "NEVER GONNA TELL A LIE AND HURT YOU",
  "Thanks for not providing any arguments, it took me a while to think of all these random responses, I appreciate you."
];

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  bot.registerCommand("say", async (msg, args) => {
    if (! (await utils.messageIsOnInboxServer(msg))) return;
    if (! utils.isStaff(msg.member)) return;
    if (! args[0]) {
      const response = randoms[Math.floor(Math.random() * randoms.length)];
      return bot.createMessage(msg.channel.id, response);
    }

    let channel = msg.channel;

    if (args[1]) {
      const foundChannel = msg.channel.guild.channels.find(c => {
        return c.id === args[0]
          || c.id == args[0].substring(2, args[0].length - 1)
          || c.name.toLowerCase() === args[0].toLowerCase();
      });

      if (foundChannel) {
        const memberPerms = foundChannel.permissionsOf(msg.member.id);
        const davePerms = foundChannel.permissionsOf(bot.user.id);

        if (memberPerms.has("readMessages") && memberPerms.has("sendMessages") && davePerms.has("readMessages") && davePerms.has("sendMessages")) {
          channel = foundChannel;
          args.splice(0, 1);
        }
      }
    }

    channel.createMessage(args.join(" "))
      .then(() => bot.deleteMessage(msg.channel.id, msg.id)) // Cause this to error to see if the .catch catches it
      .catch(() => null);
  });
};
