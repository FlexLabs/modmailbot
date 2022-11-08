const moment = require("moment");
const Eris = require("eris");
const SSE = require("express-sse");
const humanizeDuration = require("humanize-duration");

const bot = require("../bot");
const knex = require("../knex");
const config = require("../config");
const attachments = require("./attachments");

const ThreadMessage = require("./ThreadMessage");

const {THREAD_MESSAGE_TYPE, THREAD_STATUS} = require("../utils/constants");
const {internalButtons} = require("../utils/components");
const lastMsgs = new Map();

/**
 * @property {String} id
 * @property {Boolean} closed
 * @property {Number} status
 * @property {String} user_id
 * @property {String} user_name
 * @property {String} channel_id
 * @property {String} scheduled_close_at
 * @property {String} scheduled_close_id
 * @property {String} scheduled_close_name
 * @property {String?} alert_users
 * @property {Object?} staff_role_overrides
 * @property {String} created_at
 * @param {String} topic the button the user clicked if any
 */
class Thread {
  constructor(props) {
    utils.setDataModelProps(this, props);
  }

  /**
   * @param {Eris.Member} moderator
   * @param {String} text
   * @param {Eris.Attachment[]} [replyAttachments=[]]
   * @param {Boolean} [isAnonymous=false]
   * @param {SSE} [sse]
   * @returns {Promise<void>}
   */
  async replyToUser(moderator, text, replyAttachments = [], isAnonymous = false, sse) {
    // Username to reply with
    let modUsername, logModUsername;
    let channel = moderator.guild && moderator.guild.channels && moderator.guild.channels.get(this.channel_id);
    let mainRole = this.getMainRole(moderator, channel ? channel.parentID : undefined, this.topic);

    if (isAnonymous) {
      modUsername = mainRole.name;
      logModUsername = `(${moderator.user.username}) ${modUsername}`;
    } else {
      const name = (config.useNicknames ? moderator.nick || moderator.user.username : moderator.user.username);
      modUsername = `(${name}) ${mainRole.name}`;
      logModUsername = modUsername;
    }

    // Build the reply message
    let dmContent = `**${modUsername}:** ${text}`;
    let threadContent = `**${logModUsername}:** ${text}`;
    let logContent = text;

    if (config.threadTimestamps) {
      const timestamp = utils.getTimestamp();
      threadContent = `[**${timestamp}**] » ${threadContent}`;
    }

    // Prepare attachments, if any
    let files = [];

    if (replyAttachments.length > 0) {
      for (const attachment of replyAttachments) {
        files.push(await attachments.attachmentToFile(attachment));
        const url = await attachments.getUrl(attachment.id, attachment.filename);

        logContent += `\n\n**Attachment:** ${url}`;
      }
    }

    // Send the reply DM
    let dmMessage;
    try {
      dmMessage = await this.postToUser(dmContent, files);
    } catch (e) {
      await this.postSystemMessage(`Error while replying to user: ${e.message}`);
      return;
    }

    // Send the reply to the modmail thread
    const threadMessage = await this.postToThreadChannel(threadContent, files);
    if (! threadMessage) return; // This will be undefined if the channel is deleted

    // Add the message to the database
    await this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.TO_USER,
      user_id: moderator.id,
      user_name: logModUsername,
      body: logContent,
      is_anonymous: (isAnonymous ? 1 : 0),
      dm_message_id: dmMessage.id,
      thread_message_id: threadMessage.id
    }, sse);

    if (this.scheduled_close_at) {
      await this.cancelScheduledClose();
      const systemMessage = await this.postSystemMessage("Cancelling scheduled closing of this thread due to new reply");
      if (systemMessage) {
        setTimeout(() => systemMessage.delete(), 30000);
      }
    }
  }

  /**
   * @param {Eris.Message} msg
   * @param {SSE} sse
   * @returns {Promise<void>}
   */
  async receiveUserReply(msg, sse) {
    const extraContent = [];
    const stickers = msg.stickerItems && msg.stickerItems.map((s) => s.name);

    if (msg.embeds && msg.embeds.length) {
      extraContent.push(`${msg.embeds.length} embed${msg.embeds.length == 1 ? "" : "s"}`);
    }

    if (stickers && stickers.length) {
      extraContent.push(`${stickers.length} sticker${stickers.length == 1 ? "" : "s"} (${stickers.join(", ")})`);
    }

    let logContent = msg.content;

    if (extraContent.length) {
      logContent += `\n\n<message contains ${extraContent.join(" & ")}>`;
    }

    // Prepare attachments, if any

    const attachmentFiles = [];

    if (msg.attachments.length) {
      for (const attachment of msg.attachments) {
        await attachments.saveAttachment(attachment);

        // Forward small attachments (<2MB) as attachments, just link to larger ones

        const formatted = "\n\n" + await utils.formatAttachment(attachment);

        logContent += formatted; // Logs always contain the link

        if (config.relaySmallAttachmentsAsAttachments && attachment.size <= 1024 * 1024 * 2) {
          const file = await attachments.attachmentToFile(attachment);
          attachmentFiles.push(file);
        }
      }
    }

    let threadContent = `**${msg.author.username}#${msg.author.discriminator}:** ${logContent}`;

    if (config.threadTimestamps) {
      const timestamp = utils.getTimestamp(msg.timestamp, "x");
      threadContent = `[**${timestamp}**] « ${threadContent}`;
    }

    const threadMessage = await this.postToThreadChannel(threadContent, attachmentFiles);
    if (! threadMessage) {
      await bot.createMessage(msg.channel.id, "The current thread was automatically closed due to an internal error. Please send another message to open a new thread.");
      return;
    }

    await this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.FROM_USER,
      user_id: this.user_id,
      user_name: `${msg.author.username}#${msg.author.discriminator}`,
      body: logContent,
      is_anonymous: 0,
      dm_message_id: msg.id,
      thread_message_id: threadMessage.id
    }, sse);

    if (this.alert_users) {
      const alerts = this.alert_users.split(", ")
        .filter(id => {
          const wait = lastMsgs.get(`${this.id}-${id}`);

          if (wait && Date.now() - wait < 10000) {
            return false;
          }

          lastMsgs.set(`${this.id}-${id}`, Date.now());

          return id !== this.scheduled_close_id;
        })
        .map((id, i, arr) => (i == 0 ? "" : (i == arr.length - 1 ? " and " : ", ")) + `<@${id}>`)
        .join("");

      if (alerts.length) {
        this.postSystemMessage(`${alerts}, there is a new message from **${this.user_name}**!`);
      }
    }

    if (this.scheduled_close_at) {
      const now = moment();
      const closedAt = moment(this.scheduled_close_at);

      let systemMessage;

      if (closedAt.diff(now) <= 30000) {
        await this.cancelScheduledClose();
        systemMessage = await this.postSystemMessage({
          content: `<@!${this.scheduled_close_id}> Thread that was scheduled to be closed got a new reply. Cancelling.`,
        });
      } else {
        systemMessage = await this.postSystemMessage({
          content: `<@!${this.scheduled_close_id}> The thread was updated, use \`!close cancel\` if you would like to cancel.`,
        });
      }

      if (systemMessage) {
        setTimeout(() => systemMessage.delete().catch(() => null), 30000);
      }
    }
  }

  /**
   * @returns {Promise<Eris.PrivateChannel>}
   */
  getDMChannel() {
    return bot.getDMChannel(this.user_id);
  }

  /**
   * @param {Eris.MessageContent} text
   * @param {Eris.MessageFile|Eris.MessageFile[]} [file=null]
   * @returns {Promise<Eris.Message<Eris.PrivateChannel>>}
   * @throws Error
   */
  async postToUser(text, file = null) {
    // Try to open a DM channel with the user
    const dmChannel = await this.getDMChannel();
    if (! dmChannel) {
      throw new Error("Could not open DMs with the user. They may have blocked the bot or set their privacy settings higher.");
    }

    // Send the DM
    return dmChannel.createMessage(text, file);
  }

  /**
   * @param {Eris.MessageContent} content
   * @param {Eris.MessageFile|Eris.MessageFile[]} [file]
   * @returns {Promise<Eris.Message<Eris.GuildTextableChannel>>}
   */
  async postToThreadChannel(content, file) {
    try {
      return await bot.createMessage(this.channel_id, content, file);
    } catch (e) {
      // Channel not found
      if (e.code === 10003) {
        console.log(`[INFO] Auto-closing thread with ${this.user_name} because the channel no longer exists`);
        this.close(bot.user, true);
      } else {
        throw e;
      }
    }
  }

  /**
   * @param {Eris.MessageContent} text
   * @param {Boolean} [plainBody] Whether the bot should save a plain text version of an embed (if provided) to the DB
   * @returns {Promise<Eris.Message<Eris.GuildTextableChannel>>}
   */
  async postSystemMessage(text, plainBody) {
    const msg = await this.postToThreadChannel(text);
    if (! msg) return; // This will be undefined if the channel is deleted

    if (plainBody === true && text.embed) {
      const strings = [];
      const embed = text.embed;

      if (text.content)
        strings.push(text.content);

      if (embed.author && embed.author.name)
        strings.push(embed.author.name);

      if (embed.title)
        strings.push(embed.title);

      if (embed.description)
        strings.push(embed.description);

      if (embed.fields)
        strings.push(embed.fields.map((f) => `**${f.name}:** ${f.value}`).join("\n"));

      if (embed.footer && embed.footer.text)
        strings.push(embed.footer.text);

      if (strings.length)
        text = strings.join("\n");
    }

    await this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.SYSTEM,
      user_id: null,
      user_name: "",
      body: typeof text === "string" ? text : (text.content + (text.embed ? "\n\n<embed>" : "")).trim(),
      is_anonymous: 0,
      dm_message_id: msg.id,
      thread_message_id: msg.id
    });

    // return the message so we can delete it if we want.
    return msg;
  }

  /**
   * @param {Eris.MessageContent} content
   * @param {Eris.MessageFile|Eris.MessageFile[]} [file]
   * @returns {Promise<void>}
   */
  async postNonLogMessage(content, file) {
    await this.postToThreadChannel(content, file);
  }

  /**
   * @param {String} topic If the user opened the thread, this will be the label of which ever button they pressed
   */
  async sendThreadInfo(topic) {
    const now = Date.now();
    const user = bot.users.get(this.user_id);
    const [
      member,
      userLogCount,
      userNotes
    ] = await Promise.all([
      utils.getMainGuild().then((g) => g.getRESTMember(user.id)).catch(() => null),
      threads.getClosedThreadCountByUserId(user.id),
      notes.get(user.id),
    ]);

    let displayNote = "None";

    if (userNotes && userNotes.length) {
      const note = userNotes[userNotes.length - 1];
      displayNote = `${note.note} - [${note.created_at}] (${note.created_by_name})`;
    }

    const mainGuildNickname = member && member.nick && `(${member.nick})`;
    const accountAge = humanizeDuration(now - user.createdAt, {largest: 2});
    const memberFor = member ? humanizeDuration(now - member.joinedAt, {largest: 2}) : "Unavailable";
    const fields = [
      {name: "User", value: `${user.username}#${user.discriminator} ${mainGuildNickname || ""}`, inline: true},
      {name: "Account age", value: accountAge, inline: true},
      {name: "Member for", value: memberFor, inline: true},
      {name: `Thread ID (${userLogCount} Logs)`, value: this.id, inline: true}
    ];

    if (topic) {
      fields.push({
        name: "Topic",
        value: topic,
        inline: true
      });
    }

    const roles = member && member.roles.map((r) => member.guild.roles.get(r)).sort((a, b) => b.position - a.position);
    const highestColor = utils.getUserRoleColor(member);

    fields.push(
      {
        name: `Last note (${userNotes.length})`,
        value: displayNote
      },
      {
        name: `Roles (${roles && roles.length || 0})`,
        value: roles ? roles.map((r) => r.name).join(", ") || "None" : "Unavailable"
      }
    );

    const data = {
      content: user.mention,
      embed: {
        fields,
        footer: {text: user.id},
        timestamp: new Date(),
        color: highestColor || 0x337FD5,
      }
    };

    // Only add the buttons if a topic is provided!

    if (topic) {
      data.components = internalButtons;
    }

    return await this.postSystemMessage(data, true);
  }

  /**
   * @param {Eris.Message<Eris.GuildTextableChannel>} msg
   * @param {SSE} sse
   * @returns {Promise<void>}
   */
  async saveChatMessage(msg, sse) {
    return this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.CHAT,
      user_id: msg.author.id,
      user_name: `${msg.author.username}#${msg.author.discriminator}`,
      body: msg.content,
      is_anonymous: 0,
      dm_message_id: msg.id,
      thread_message_id: msg.id
    }, sse);
  }

  /**
   * @param {Eris.Message<Eris.GuildTextableChannel>} msg
   * @param {SSE} sse
   * @returns {Promise<void>}
   */
  async saveCommandMessage(msg, sse) {
    return this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.COMMAND,
      user_id: msg.author.id,
      user_name: `${msg.author.username}#${msg.author.discriminator}`,
      body: msg.content,
      is_anonymous: 0,
      dm_message_id: msg.id,
      thread_message_id: msg.id
    }, sse);
  }

  /**
   * @param {Eris.Message} msg
   * @param {Eris.Message} threadMessage
   * @returns {Promise<void>}
   */
  async updateChatMessage(msg, threadMessage) {
    await knex("thread_messages")
      .where("thread_id", this.id)
      .where("dm_message_id", msg.id)
      .update({
        body: msg.content,
        thread_message_id: threadMessage.id,
      });
  }

  async getThreadMessageFromDM(msg) {
    return knex("thread_messages")
      .where("thread_id", this.id)
      .where("dm_message_id", msg.id)
      .first();
  }

  async getThreadMessageFromThread(msgID) {
    return knex("thread_messages")
      .where("thread_id", this.id)
      .where("thread_message_id", msgID)
      .first();
  }

  /**
   * @param {String} messageId
   * @returns {Promise<void>}
   */
  async deleteChatMessage(messageId) {
    await knex("thread_messages")
      .where("thread_id", this.id)
      .where("dm_message_id", messageId)
      .delete();
  }

  /**
   * @param {{ [s: string]: any; }} data
   * @param {SSE} [sse]
   * @returns {Promise<void>}
   */
  async addThreadMessageToDB(data, sse) {
    const threadMessage = {
      thread_id: this.id,
      created_at: moment.utc().format("YYYY-MM-DD HH:mm:ss"),
      is_anonymous: 0,
      ...data
    };

    await knex("thread_messages").insert(threadMessage);

    if (sse) {
      sse.send({
        message: threadMessage
      }, "newMessage", null);
    }
  }

  /**
   * @returns {Promise<ThreadMessage[]>}
   */
  async getThreadMessages() {
    const threadMessages = await knex("thread_messages")
      .where("thread_id", this.id)
      .orderBy("created_at", "ASC")
      .orderBy("id", "ASC")
      .select();

    return threadMessages.map(row => new ThreadMessage(row));
  }

  /**
   * @param {String} userId
   * @param {Boolean} status
   * @returns {Promise<void>}
   */
  async alertStatus(userId, status) {
    let alerts = await knex("threads")
      .where("id", this.id)
      .select("alert_users")
      .first();

    alerts = (alerts.alert_users && alerts.alert_users.split(", ")) || [];

    if (! alerts.includes(userId) && status === true) {
      alerts.push(userId);
    } else if (status === false) {
      const index = alerts.indexOf(userId);

      if (index > -1) {
        alerts.splice(index, 1);
      }
    }

    if (alerts.length > 0) {
      alerts = alerts.join(", ");
    } else {
      alerts = null;
    }

    await knex("threads")
      .where("id", this.id)
      .update({
        alert_users: alerts
      });
  }

  /**
   * @param {Eris.User|{ discriminator: string; id: string; username: string; }} author
   * @param {Boolean} [silent=false]
   * @param {SSE} [sse]
   * @returns {Promise<void>}
   */
  async close(author, silent = false, sse) {
    if (! silent) {
      console.log(`Closing thread ${this.id}`);
      await this.postToThreadChannel("Closing thread...");
    }

    if (! author) {
      let newThread = await knex("threads")
        .where("id", this.id)
        .first();
      author = {
        id: newThread.scheduled_close_id,
        username: newThread.scheduled_close_name.split("#").slice(0, -1).join("#"),
        discriminator: newThread.scheduled_close_name.split("#").slice(-1)[0],
      };
    }
    // Update DB status
    await knex("threads")
      .where("id", this.id)
      .update({
        status: THREAD_STATUS.CLOSED,
        scheduled_close_at: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
        scheduled_close_id: author.id,
        scheduled_close_name: `${author.username}#${author.discriminator}`,
        alert_users: null,
        staff_role_overrides: null
      });

    if (sse)
      sse.send({
        thread: await knex("threads")
          .where("id", this.id)
          .first()
      }, "threadClose", null);

    // Delete channel
    /**
     * @type {Eris.GuildTextableChannel}
     */
    const channel = bot.getChannel(this.channel_id);
    if (channel) {
      if(! this.isCT && channel.parentID == config.communityThreadCategoryId) {
        this.addCommunityAccess();
      }
      if (this.isPrivate && (channel.parentID == config.newThreadCategoryId || channel.parentID == config.communityThreadCategoryId)) {
        this.makePublic();
      } else if (! this.isPrivate && (channel.parentID != config.newThreadCategoryId && channel.parentID != config.communityThreadCategoryId)) {
        this.makePrivate();
      }

      console.log(`Deleting channel ${this.channel_id}`);

      await channel.delete("Thread closed");
    }
  }

  /**
   * @param {String} time
   * @param {Eris.User} user
   * @returns {Promise<void>}
   */
  async scheduleClose(time, user) {
    await knex("threads")
      .where("id", this.id)
      .update({
        scheduled_close_at: time,
        scheduled_close_id: user.id,
        scheduled_close_name: `${user.username}#${user.discriminator}`
      });
  }

  /**
   * @returns {Promise<void>}
   */
  async cancelScheduledClose() {
    await knex("threads")
      .where("id", this.id)
      .update({
        scheduled_close_at: null,
        scheduled_close_id: null,
        scheduled_close_name: null
      });
  }

  /**
   * @returns {Promise<void>}
   */
  async suspend() {
    await knex("threads")
      .where("id", this.id)
      .update({
        status: THREAD_STATUS.SUSPENDED
      });
  }

  /**
   * @returns {Promise<void>}
   */
  async unsuspend() {
    await knex("threads")
      .where("id", this.id)
      .update({
        status: THREAD_STATUS.OPEN
      });
  }

  /**
   * @param {String} userId
   * @param {String} roleId
   * @returns {Promise<void>}
   */
  async setStaffRoleOverride(userId, roleId) {
    let overrides = await knex("threads")
      .where("id", this.id)
      .select("staff_role_overrides")
      .first();

    if (overrides.staff_role_overrides) {
      overrides = JSON.parse(overrides.staff_role_overrides);
    } else {
      overrides = {};
    }

    overrides[userId] = roleId;

    await knex("threads")
      .where("id", this.id)
      .update({
        staff_role_overrides: JSON.stringify(overrides)
      });
  }

  /**
   * @param {String} userId
   * @returns {Promise<void>}
   */
  async deleteStaffRoleOverride(userId) {
    let overrides = await knex("threads")
      .where("id", this.id)
      .select("staff_role_overrides")
      .first();

    if (overrides.staff_role_overrides) {
      overrides = JSON.parse(overrides.staff_role_overrides);

      if (overrides[userId]) {
        delete overrides[userId];
        await knex("threads")
          .where("id", this.id)
          .update({
            staff_role_overrides: JSON.stringify(overrides)
          });
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async makePrivate() {
    return await knex("threads")
      .where("id", this.id)
      .update({
        isPrivate: true
      });
  }

  /**
   * @returns {Promise<void>}
   */
  async makePublic() {
    return await knex("threads")
      .where("id", this.id)
      .update({
        isPrivate: false
      });
  }

  /**
   * @returns {Promise<void>}
   */
  async addCommunityAccess() {
    return await knex("threads")
      .where("id", this.id)
      .update({
        isCT: true
      });
  }
  /**
   * @param {String} userId
   * @returns {String?}
   */
  getStaffRoleOverride(userId) {
    if (this.staff_role_overrides) {
      return JSON.parse(this.staff_role_overrides)[userId];
    }
  }

  /**
   * @param {Eris.Member} member
   * @param {String} categoryID
   * @param {String} topic If the user opened the thread, this will be the label of which ever button they pressed
   * @returns {Eris.Role}
   */
  getMainRole(member, categoryID, topic) {
    const role = this.getStaffRoleOverride(member.id);
    const guild = member.guild;

    if (role) {
      const override = guild && guild.roles && guild.roles.get(role);

      if (override) {
        return override;
      }
    }

    if (categoryID) {
      const adminOverrides = { // These hard-coded IDs are temp
        "429054322555355158": "203040224597508096",
        "842139696313139309": "523021576128692239"
      };

      if (adminOverrides[categoryID]) {
        const role = guild && guild.roles && guild.roles.get(adminOverrides[categoryID]);

        if (role) {
          return role;
        }
      }
    }

    if (topic === "Moderation Help") {
      return { name: "Moderator" };
    } else return { name: "Staff" };
  }

  /**
   * @returns {Promise<String>}
   */
  getLogUrl() {
    return utils.getSelfUrl(`#thread/${this.id}`);
  }
}

module.exports = Thread;
const threads = require("./threads");
const notes = require("./notes");
const utils = require("../utils/utils");
