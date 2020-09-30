const moment = require("moment");
const Eris = require("eris");
const SSE = require("express-sse");

const bot = require("../bot");
const knex = require("../knex");
const utils = require("../utils");
const config = require("../config");
const attachments = require("./attachments");

const ThreadMessage = require("./ThreadMessage");

const {THREAD_MESSAGE_TYPE, THREAD_STATUS} = require("./constants");

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
 * @property {String} created_at
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
    const mainRole = utils.getMainRole(moderator);

    if (isAnonymous) {
      modUsername = (mainRole ? mainRole.name : "Staff");
      logModUsername = `(${moderator.user.username}) ${mainRole ? mainRole.name : "Staff"}`;
    } else {
      const name = (config.useNicknames ? moderator.nick || moderator.user.username : moderator.user.username);
      modUsername = (mainRole ? `(${name}) ${mainRole.name}` : name);
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
    await this.postToThreadChannel(threadContent, files);

    // Add the message to the database
    await this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.TO_USER,
      user_id: moderator.id,
      user_name: logModUsername,
      body: logContent,
      is_anonymous: (isAnonymous ? 1 : 0),
      dm_message_id: dmMessage.id
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
   * @param {Eris.Member} moderator
   * @param {Eris.MessageContent} message
   * @param {{ _id: any; name: string; _state: number; }} command
   * @param {Boolean} [isAnonymous=false]
   * @returns {Promise<void>}
   */
  async sendCommandToUser(moderator, message, command, isAnonymous = false) {
    // Username to reply with
    let modUsername, logModUsername;
    const mainRole = utils.getMainRole(moderator);
    const text = `[Command Help: ${command.name}]`;

    if (isAnonymous) {
      modUsername = (mainRole ? mainRole.name : "Moderator");
      logModUsername = `(Anonymous) (${moderator.user.username}) ${mainRole ? mainRole.name : "Moderator"}`;
    } else {
      const name = (config.useNicknames ? moderator.nick || moderator.user.username : moderator.user.username);
      modUsername = (mainRole ? `(${mainRole.name}) ${name}` : name);
      logModUsername = modUsername;
    }

    // Build the reply message
    let threadContent = `**${logModUsername}:** ${text}`;
    let logContent = text;

    if (config.threadTimestamps) {
      const timestamp = utils.getTimestamp();
      threadContent = `[${timestamp}] » ${threadContent}`;
    }

    // Send the reply DM
    let dmMessage;
    try {
      dmMessage = await this.postToUser(message);
    } catch (e) {
      await this.postSystemMessage(`Error while replying to user: ${e.message}`);
      return;
    }

    // Send the reply to the modmail thread
    await this.postToThreadChannel(threadContent);

    // Add the message to the database
    await this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.TO_USER,
      user_id: moderator.id,
      user_name: logModUsername,
      body: logContent,
      is_anonymous: (isAnonymous ? 1 : 0),
      dm_message_id: dmMessage.id
    });

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
    let content = msg.content;
    if (msg.content.trim() === "" && msg.embeds.length) {
      content = "<message contains embeds>";
    }

    let threadContent = `**${msg.author.username}#${msg.author.discriminator}:** ${content}`;
    let logContent = msg.content;

    if (config.threadTimestamps) {
      const timestamp = utils.getTimestamp(msg.timestamp, "x");
      threadContent = `[**${timestamp}**] « ${threadContent}`;
    }

    // Prepare attachments, if any
    let attachmentFiles = [];

    for (const attachment of msg.attachments) {
      await attachments.saveAttachment(attachment);

      // Forward small attachments (<2MB) as attachments, just link to larger ones
      const formatted = "\n\n" + await utils.formatAttachment(attachment);
      logContent += formatted; // Logs always contain the link

      if (config.relaySmallAttachmentsAsAttachments && attachment.size <= 1024 * 1024 * 2) {
        const file = await attachments.attachmentToFile(attachment);
        attachmentFiles.push(file);
      } else {
        threadContent += formatted;
      }
    }

    await this.postToThreadChannel(threadContent, attachmentFiles);
    await this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.FROM_USER,
      user_id: this.user_id,
      user_name: `${msg.author.username}#${msg.author.discriminator}`,
      body: logContent,
      is_anonymous: 0,
      dm_message_id: msg.id
    }, sse);

    if (this.scheduled_close_at) {
      const now = moment();
      const closedAt = moment(this.scheduled_close_at);

      let systemMessage;

      if (closedAt.diff(now) <= 30000) {
        await this.cancelScheduledClose();
        systemMessage = await this.postSystemMessage({
          content: `<@!${this.scheduled_close_id}> Thread that was scheduled to be closed got a new reply. Cancelling.`,
          allowedMentions: { everyone: false }
        });
      } else {
        systemMessage = await this.postSystemMessage({
          content: `<@!${this.scheduled_close_id}> The thread was updated, use \`!close cancel\` if you would like to cancel.`,
          allowedMentions: { everyone: false }
        });
      }

      if (systemMessage) {
        setTimeout(() => systemMessage.delete(), 30000);
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
   * @param {String} text
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
      return bot.createMessage(this.channel_id, content, file);
    } catch (e) {
      // Channel not found
      if (e.code === 10003) {
        console.log(`[INFO] Auto-closing thread with ${this.user_name} because the channel no longer exists`);
        this.close(bot.user);
      } else {
        throw e;
      }
    }
  }

  /**
   * @param {Eris.MessageContent} text
   * @param {Eris.MessageFile|Eris.MessageFile[]} [file]
   * @returns {Promise<Eris.Message<Eris.GuildTextableChannel>>}
   */
  async postSystemMessage(text, file) {
    const msg = await this.postToThreadChannel(text, file);
    await this.addThreadMessageToDB({
      message_type: THREAD_MESSAGE_TYPE.SYSTEM,
      user_id: null,
      user_name: "",
      body: typeof text === "string" ? text : text.content,
      is_anonymous: 0,
      dm_message_id: msg.id
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
      dm_message_id: msg.id
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
      dm_message_id: msg.id
    }, sse);
  }

  /**
   * @param {Eris.Message} msg
   * @returns {Promise<void>}
   */
  async updateChatMessage(msg) {
    await knex("thread_messages")
      .where("thread_id", this.id)
      .where("dm_message_id", msg.id)
      .update({
        body: msg.content
      });
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
    let threadMessage = {
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
    
    if(! author) {
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
        scheduled_close_name: `${author.username}#${author.discriminator}`
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
   * @returns {Promise<String>}
   */
  getLogUrl() {
    return utils.getSelfUrl(`#thread/${this.id}`);
  }
}

module.exports = Thread;
