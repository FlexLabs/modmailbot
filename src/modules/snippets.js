const Eris = require("eris");
const config = require("../config");
const threads = require("../data/threads");
const snippets = require("../data/snippets");
const threadUtils = require("../utils/threadUtils");
const utils = require("../utils/utils");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  /**
   * When a staff member uses a snippet (snippet prefix + trigger word), find the snippet and post it as a reply in the thread
   */
  bot.on("messageCreate", async msg => {
    if (! (await utils.messageIsOnInboxServer(msg))) return;
    if (! utils.isStaff(msg.member)) return;

    if (msg.author.bot) return;
    if (! msg.content) return;
    if (! msg.content.startsWith(config.snippetPrefix)) return;

    const thread = await threads.findByChannelId(msg.channel.id);
    if (! thread) return;

    const trigger = msg.content.replace(config.snippetPrefix, "").toLowerCase();
    const snippet = await snippets.get(trigger);
    if (! snippet) return;

    await thread.replyToUser(msg.member, snippet.body, [], true);
    msg.delete();
  });

  // Show or add a snippet
  threadUtils.addInboxServerCommand(bot, "snippet", async (msg, args, thread) => {
    const trigger = args[0];
    if (! trigger) return;

    const snippet = await snippets.get(trigger);
    let text = args.slice(1).join(" ").trim();
    let isAnonymous = config.snippetAnonDefault || false;

    if (args[1] === "anon") {
      text = args.slice(2).join(" ").trim();
      isAnonymous = true;
    }

    if (snippet) {
      if (args[1] === "raw") {
        // Post the raw snippet in a codeblock if it exists.
        utils.postSystemMessageWithFallback(msg.channel, thread, `\`${config.snippetPrefix}${trigger}\` replies ${snippet.is_anonymous ? "anonymously " : ""}with:\n\`\`\`\n${snippet.body}\`\`\``);
      } else if (text) {
        // If the snippet exists and we're trying to create a new one, inform the user the snippet already exists
        utils.postError(thread, `Snippet \`${trigger}\` already exists! You can edit or delete it with ${config.prefix}edit_snippet and ${config.prefix}delete_snippet respectively.`, null, msg);
      } else {
        // If the snippet exists and we're NOT trying to create a new one, show info about the existing snippet
        utils.postSystemMessageWithFallback(msg.channel, thread, `\`${config.snippetPrefix}${trigger}\` replies ${snippet.is_anonymous ? "anonymously " : ""}with:\n${snippet.body}`);
      }
    } else {
      if (text) {
        // If the snippet doesn't exist and the user wants to create it, create it
        await snippets.add(trigger, text, isAnonymous, msg.author.id);
        utils.postSuccess(thread, `Snippet \`${trigger}\` created!`, null, msg);
      } else {
        // If the snippet doesn't exist and the user isn't trying to create it, inform them how to create it
        utils.postError(thread, `Snippet \`${trigger}\` doesn't exist! You can create it with \`${config.prefix}snippet ${trigger} text\``, null, msg);
      }
    }
  });

  bot.registerCommandAlias("s", "snippet");

  threadUtils.addInboxServerCommand(bot, "delete_snippet", async (msg, args, thread) => {
    const trigger = args[0];
    if (! trigger) return;

    const snippet = await snippets.get(trigger);
    if (! snippet) {
      utils.postError(thread, `Snippet \`${trigger}\` doesn't exist!`, null, msg);
      return;
    }

    await snippets.del(trigger);
    utils.postSuccess(thread, `Snippet \`${trigger}\` deleted!`, null, msg);
  });

  bot.registerCommandAlias("ds", "delete_snippet");

  threadUtils.addInboxServerCommand(bot, "edit_snippet", async (msg, args, thread) => {
    const trigger = args[0];
    if (! trigger) return;

    let text = args.slice(1).join(" ").trim();
    if (! text) return;

    const snippet = await snippets.get(trigger);
    if (! snippet) {
      utils.postError(thread, `Snippet \`${trigger}\` doesn't exist!`, null, msg);
      return;
    }

    let isAnonymous = true;

    await snippets.del(trigger);
    await snippets.add(trigger, text, isAnonymous, msg.author.id);

    utils.postSuccess(thread, `Snippet \`${trigger}\` edited!`, null, msg);
  });

  bot.registerCommandAlias("es", "edit_snippet");

  threadUtils.addInboxServerCommand(bot, "snippet_info", async (msg, args, thread) => {
    const trigger = args[0];
    if (! trigger) return;

    const snippet = await snippets.get(trigger);
    if (! snippet) {
      utils.postError(thread, `Snippet \`${trigger}\` doesn't exist!`, null, msg);
      return;
    }

    utils.postInfo(thread, `**Snippet Info - ${trigger}**\n\n**Trigger:** ${config.snippetPrefix}${snippet.trigger}\n`
    + `**Body:** Use \`${config.prefix}s ${snippet.trigger}\` to see the snippet body!\n`
    + `**Replies Anonymously:** ${snippet.is_anonymous ? "Yes" : "No"}\n`
    + `**Created By:** ${snippet.created_by}`,
    null,
    msg
    );
  });

  bot.registerCommandAlias("is", "snippet_info");

  threadUtils.addInboxServerCommand(bot, "snippets", async (msg, args, thread) => {
    const allSnippets = await snippets.all();
    const triggers = allSnippets.map(s => s.trigger);
    triggers.sort();

    utils.postInfo(thread, `Available snippets (prefix ${config.snippetPrefix}):\n${triggers.join(", ")}`, null, msg);
  });
};
