const Eris = require("eris");
const moment = require("moment");
const knex = require("../knex");
const utils = require("../utils/utils");

/**
 * Checks whether userId is blocked
 * @param {String} userId
 * @returns {Promise<Boolean>}
 */
async function isBlocked(userId) {
  const row = await knex("blocked_users")
    .where("user_id", userId)
    .first();

  return !! row;
}

/**
 * Blocks the given userId
 * @param {String} userId
 * @param {String} userName
 * @param {String} blockedBy
 * @returns {Promise<number[]>}
 */
async function block(userId, userName = "", blockedBy = null) {
  if (await isBlocked(userId)) return;

  return knex("blocked_users")
    .insert({
      user_id: userId,
      user_name: userName,
      blocked_by: blockedBy,
      blocked_at: moment.utc().format("YYYY-MM-DD HH:mm:ss")
    });
}

/**
 * Unblocks the given userId
 * @param {String} userId
 * @returns {Promise<number>}
 */
async function unblock(userId) {
  return knex("blocked_users")
    .where("user_id", userId)
    .delete();
}

/**
 * Logs the block/unblock to the logging channel
 * @param {Eris.User} user
 * @param {Eris.Member} moderator
 * @param {String} reason
 * @param {Boolean} isUnblock
 */
function logBlock(user, moderator, reason, isUnblock = false) {
  let logText = `**${isUnblock ? "Un" : "B"}locked:** ${user.username}#${user.discriminator} (${user.id}) was ${isUnblock ? "un" : ""}blocked by ${moderator.username}#${moderator.discriminator} (${moderator.id})`;

  if (reason) {
    logText += ` for ${reason}`;
  }

  return utils.postLog(logText);
}

module.exports = {
  isBlocked,
  block,
  unblock,
  logBlock
};
