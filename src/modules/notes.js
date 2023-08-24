const Eris = require("eris");
const notes = require("../data/notes");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");
const pagination = new Map;
const { createPagination, paginate } = require("../utils/pagination");

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

      if (! userId) return utils.postError(thread, "Please provide a user mention or ID!", null, msg);

      user = bot.users.get(userId);
      if (! user) {
        user = await bot.getRESTUser(userId).catch(() => null);
        if (! user) return utils.postError(thread, "I can't find that user!", null, msg);
      }

      usage = `!note ${userId} <note>`;
    }

    let text = args.join(" ");
    let userNotes = await notes.get(userId);

    if (! text)
      utils.postError(thread, `Incorrect command usage. Add a note with \`${usage}\`.`, null, msg);
    else if (userNotes.some(note => note.note === text))
      utils.postError(thread, "This note already exists, try something else.", null, msg);
    else {
      await notes.add(userId, text.replace(/\n/g, " "), msg.author, thread);
      utils.postSuccess(thread, `Added ${
        userNotes.length ? "another" : "a"
      } note for ${user ? `${user.username}` : thread.user_name}!`, null, msg);
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

    if (! userId) return utils.postError(thread, "Please provide a user mention or ID!", null, msg);

    let user = bot.users.get(userId);

    if (! user) {
      user = await bot.getRESTUser(userId).catch(() => null);
      if (! user) return utils.postError(thread, "I can't find that user!", null, msg);
    }

    const userNotes = await notes.get(userId);
    if (! userNotes || ! userNotes.length) return utils.postError(thread, `There are no notes for this user. Add one with \`${usage}\`.`, null, msg);

    const paginated = paginate(userNotes.map((note, i) => {
      note.i = i + 1;
      return note;
    }));

    // NOTE I know this is kinda messy, I will clean this up in a future release - Bsian

    const selfURL = await utils.getSelfUrl("#thread/");

    /** @type {import("eris").MessageContent} */
    const content = {
      embeds: [{
        title: `Notes for ${user ? `${user.username} (${user.id})` : `${userId}`}`,
        fields: paginated[0].map((n) => {
          return { name: `[${n.i}] ${n.created_by_name} | ${n.created_at}`, value: `${n.note}${n.thread ? ` | [Thread](${selfURL + n.thread})` : ""}` };
        }),
        footer: { text: `${msg.author.username} | Page 1/${paginated.length}`}
      }]
    };

    content.components = [{
      type: 1,
      components: [
        {
          type: 2,
          custom_id: "pagination:prev",
          disabled: true,
          style: 1,
          emoji: { id: "950081389020201050" }
        },
        {
          type: 2,
          custom_id: "pagination:f5",
          style: 1,
          emoji: { id: "950081388835655690" }
        },
        {
          type: 2,
          custom_id: "pagination:next",
          disabled: paginated.length === 1,
          style: 1,
          emoji: { id: "950081388537843753" }
        }
      ]
    }];

    const pageMsg = await utils.awaitPostSystemMessageWithFallback(msg.channel, thread, content);

    createPagination(pageMsg.id, paginated, msg.author.id, { targetID: userId },
      async (interaction, page, currPage) => {
        const content = {
          components: interaction.message.components,
          embeds: interaction.message.embeds,
        };
        content.embeds[0].fields = currPage.map((n) => {
          return { name: `[${n.i}] ${n.created_by_name} | ${n.created_at}`, value: `${n.note}${n.thread ? ` | [Thread](${selfURL + n.thread})` : ""}` };
        });
        content.embeds[0].footer.text = `${(interaction.user || interaction.member).username} | Page ${page.index + 1}/${page.pages.length}`;

        await interaction.editParent(content);
      },
      {
        f5: async (interaction, page) => {
          const userNotes = await notes.get(page.info.targetID);
          page.pages = utils.paginate(userNotes.map((note, i) => {
            note.i = i + 1;
            return note;
          }));
          if (page.index + 1 > page.pages.length) page.index = 0;
        }
      });

    pagination.set(pageMsg.id, {
      pages: paginated,
      index: 0,
      authorID: msg.author.id,
      targetID: userId,
      expire: setTimeout(() => pagination.delete(msg.id), 3e5)
    });
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

      if (! userId) return utils.postError(thread, "Please provide a user mention or ID!", null, msg);

      user = bot.users.get(userId);

      if (! user) {
        user = await bot.getRESTUser(userId).catch(() => null);
        if (! user) return utils.postError(thread, "I can't find that user!", null, msg);
      }

      usage = `!note ${userId} <note>`;
    }

    const userNotes = await notes.get(userId);
    if (! userNotes && ! userNotes.length) {
      utils.postError(thread, `I can't edit what isn't there! Add a note with \`${usage}\`.`, null, msg);
    } else {
      let id = parseInt(args[0]);
      let text = args.slice(1).join(" ");

      if (isNaN(id)) {
        utils.postError(thread, "Invalid ID!", null, msg);
      } else if (! text) {
        utils.postError(thread, "You didn't provide any text.", null, msg);
      } else if (id > userNotes.length) {
        utils.postError(thread, "That note doesn't exist.", null, msg);
      } else {
        await notes.edit(userId, id, text.replace(/\n/g, " "), msg.author);
        utils.postSuccess(thread, `Edited note for ${user ? `${user.username}` : thread.user_name}`, null, msg);
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

      if (! userId) return utils.postError(thread, "Please provide a user mention or ID!", null, msg);

      user = bot.users.get(userId);

      if (! user) {
        user = await bot.getRESTUser(userId).catch(() => null);
        if (! user) return utils.postError(thread, "I can't find that user!", null, msg);
      }

      usage = `!note ${userId} <note>`;
    }

    const userNotes = await notes.get(userId);
    if (! userNotes || ! userNotes.length) {
      utils.postError(thread, `${user ? `${user.username}` : thread.user_name} doesn't have any notes to delete, add one with \`${usage}\`.`, null, msg);
    } else {
      let id = parseInt(args[0]);
      if (args.length && args[0].toLowerCase() === "all")
        id = -1;
      if (isNaN(id))
        utils.postError(thread, "Invalid ID!", null, msg);
      else if (id > userNotes.length)
        utils.postError(thread, "That note doesn't exist.", null, msg);
      else {
        await notes.del(userId, id);
        utils.postSuccess(thread, `Deleted ${
          id <= 0 ? "all notes" : "note"
        } for ${user ? `${user.username}` : thread.user_name}!`, null, msg);
      }
    }
  });

  bot.registerCommandAlias("dn", "delete_note");
};
