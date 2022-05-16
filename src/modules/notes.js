const Eris = require("eris");
const notes = require("../data/notes");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");
const pagination = new Map;

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  // Mods can add notes to a user which modmail will display at the start of threads using !n or !note
  // These messages get relayed back to the DM thread between the bot and the user
  threadUtils.addInboxServerCommand(bot, "note", async (msg, args, thread) => {
    let userId = thread ? thread.user_id : null;
    let usage = "!note <user>", user;

    if (! userId) {
      if (args.length > 0) {
        // User mention/id as argument
        userId = utils.getUserMention(args.shift());
      }

      if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

      user = bot.users.get(userId);
      if (! user) {
        user = await bot.getRESTUser(userId).catch(() => null);
        if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");
      }

      usage = `!note ${userId} <note>`;
    }

    let text = args.join(" ");
    let userNotes = await notes.get(userId);

    if (! text)
      utils.postSystemMessageWithFallback(msg.channel, thread, `Incorrect command usage. Add a note with \`${usage}\`.`);
    else if (userNotes.some(note => note.note === text))
      utils.postSystemMessageWithFallback(msg.channel, thread, "This note already exists, try something else.");
    else {
      await notes.add(userId, text.replace(/\n/g, " "), msg.author, thread);
      utils.postSystemMessageWithFallback(msg.channel, thread, `Added ${
        userNotes.length ? "another" : "a"
      } note for ${user ? `${user.username}#${user.discriminator}` : thread.user_name}!`);
    }
  });

  bot.registerCommandAlias("n", "note");

  threadUtils.addInboxServerCommand(bot, "notes", async (msg, args, thread) => {
    let userId = thread ? thread.user_id : null;
    let usage = "!note <note>";

    if (! userId || args.length > 0) {
      // User mention/id as argument
      userId = utils.getUserMention(args.shift());
      usage = `!note ${userId} <note>`;
    }

    if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

    let user = bot.users.get(userId);

    if (! user) {
      user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");
    }

    const userNotes = await notes.get(userId);
    if (! userNotes || ! userNotes.length) return utils.postSystemMessageWithFallback(msg.channel, thread, `There are no notes for this user. Add one with \`${usage}\`.`);

    const paginated = utils.paginate(userNotes.map((note, i) => {
      note.i = i + 1;
      return note;
    }));

    // NOTE I know this is kinda messy, I will clean this up in a future release - Bsian

    const selfURL = await utils.getSelfUrl("#thread/");

    /** @type {import("eris").MessageContent} */
    const content = {
      embeds: [{
        title: `Notes for ${user ? `${user.username}#${user.discriminator} (${user.id})` : `${userId}`}`,
        fields: paginated[0].map((n) => {
          return { name: `[${n.i}] ${n.created_by_name} | ${n.created_at}`, value: `${n.note}${n.thread ? ` | [Thread](${selfURL + n.thread})` : ""}` };
        }),
        footer: { text: `${msg.author.username}#${msg.author.discriminator} | Page 1/${paginated.length}`}
      }]
    };

    content.components = [{
      type: 1,
      components: [
        {
          type: 2,
          custom_id: "prev",
          disabled: true,
          style: 1,
          emoji: { id: "950081389020201050" }
        },
        {
          type: 2,
          custom_id: "f5",
          style: 1,
          emoji: { id: "950081388835655690" }
        },
        {
          type: 2,
          custom_id: "next",
          disabled: paginated.length === 1,
          style: 1,
          emoji: { id: "950081388537843753" }
        }
      ]
    }];

    const page = await utils.awaitPostSystemMessageWithFallback(msg.channel, thread, content);

    pagination.set(page.id, {
      pages: paginated,
      index: 0,
      authorID: msg.author.id,
      targetID: userId,
      expire: setTimeout(() => pagination.delete(msg.id), 3e5)
    });
  });

  // NOTE I know this is kinda messy, I will clean this up in a future release - Bsian
  bot.on("interactionCreate", async (interaction) => {
    if (interaction.type !== 3) return;
    if (! pagination.has(interaction.message.id)) return;

    const page = pagination.get(interaction.message.id);
    if (! (interaction.user || interaction.member).id !== page.authorID) return interaction.createMessage({
      content: "This interaction is not for you!",
      flags: 64
    });

    switch (interaction.data.custom_id) {
      case "f5": {
        const userNotes = await notes.get(page.targetID);
        page.pages = utils.paginate(userNotes.map((note, i) => {
          note.i = i + 1;
          return note;
        }));
        if (page.index + 1 > page.pages.length) page.index = 0;
        break;
      }
      case "prev":
      case "next": {
        page.index = interaction.data.custom_id === "prev" ? --page.index : ++page.index;
        break;
      }
      default: {
        interaction.createMessage({ content: "Something weird happened...", flags: 64 });
        throw new Error(`Unknown interaction custom_id "${interaction.data.custom_id}"`);
      }
    }

    clearTimeout(page.expire);

    const content = {
      embeds: interaction.message.embeds,
      components: interaction.message.components
    };

    if (page.index === 0) content.components[0].components[0].disabled = true;
    if (page.index + 1 === page.pages.length) content.components[0].components[2].disabled = true;

    const selfURL = await utils.getSelfUrl("#thread/");
    content.embeds[0].fields = page.pages[page.index].map((n) => {
      return { name: `[${n.i}] ${n.created_by_name} | ${n.created_at}`, value: `${n.note}${n.thread ? ` | [Thread](${selfURL + n.thread})` : ""}` };
    });
    content.embeds[0].footer.text = `${(interaction.user || interaction.member).username}#${(interaction.user || interaction.member).discriminator} | Page ${page.index + 1}/${page.pages.length}`;

    await interaction.editParent(content);
    page.expire = setTimeout(() => pagination.delete(interaction.message.id), 3e5);
  });

  bot.registerCommandAlias("ns", "notes");

  threadUtils.addInboxServerCommand(bot, "edit_note", async (msg, args, thread) => {
    let userId = thread ? thread.user_id : null;
    let usage = "!note <user>", user;

    if (! userId) {
      if (args.length > 0) {
        // User mention/id as argument
        userId = utils.getUserMention(args.shift());
      }

      if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

      user = bot.users.get(userId);

      if (! user) {
        user = await bot.getRESTUser(userId).catch(() => null);
        if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");
      }

      usage = `!note ${userId} <note>`;
    }

    const userNotes = await notes.get(userId);
    if (! userNotes && ! userNotes.length) {
      utils.postSystemMessageWithFallback(msg.channel, thread, `I can't edit what isn't there! Add a note with \`${usage}\`.`);
    } else {
      let id = parseInt(args[0]);
      let text = args.slice(1).join(" ");

      if (isNaN(id)) {
        utils.postSystemMessageWithFallback(msg.channel, thread, "Invalid ID!");
      } else if (! text) {
        utils.postSystemMessageWithFallback(msg.channel, thread, "You didn't provide any text.");
      } else if (id > userNotes.length) {
        utils.postSystemMessageWithFallback(msg.channel, thread, "That note doesn't exist.");
      } else {
        await notes.edit(userId, id, text.replace(/\n/g, " "), msg.author);
        utils.postSystemMessageWithFallback(msg.channel, thread, `Edited note for ${user ? `${user.username}#${user.discriminator}` : thread.user_name}`);
      }
    }
  });

  bot.registerCommandAlias("en", "edit_note");

  threadUtils.addInboxServerCommand(bot, "delete_note", async (msg, args, thread) => {
    let userId = thread ? thread.user_id : null;
    let usage = "!note <user>", user;

    if (! userId) {
      if (args.length > 0) {
        // User mention/id as argument
        userId = utils.getUserMention(args.shift());
      }

      if (! userId) return utils.postSystemMessageWithFallback(msg.channel, thread, "Please provide a user mention or ID!");

      user = bot.users.get(userId);

      if (! user) {
        user = await bot.getRESTUser(userId).catch(() => null);
        if (! user) return utils.postSystemMessageWithFallback(msg.channel, thread, "User not found!");
      }

      usage = `!note ${userId} <note>`;
    }

    const userNotes = await notes.get(userId);
    if (! userNotes || ! userNotes.length) {
      utils.postSystemMessageWithFallback(msg.channel, thread, `${user ? `${user.username}#${user.discriminator}` : thread.user_name} doesn't have any notes to delete, add one with \`${usage}\`.`);
    } else {
      let id = parseInt(args[0]);
      if (args.length && args[0].toLowerCase() === "all")
        id = -1;
      if (isNaN(id))
        utils.postSystemMessageWithFallback(msg.channel, thread, "Invalid ID!");
      else if (id > userNotes.length)
        utils.postSystemMessageWithFallback(msg.channel, thread, "That note doesn't exist.");
      else {
        await notes.del(userId, id);
        utils.postSystemMessageWithFallback(msg.channel, thread, `Deleted ${
          id <= 0 ? "all notes" : "note"
        } for ${user ? `${user.username}#${user.discriminator}` : thread.user_name}!`);
      }
    }
  });

  bot.registerCommandAlias("dn", "delete_note");
};
