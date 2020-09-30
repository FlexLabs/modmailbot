const moment = require("moment");
const knex = require("../knex");
const Note = require("./Note");
const Eris = require("eris");

/**
 * @param {String} user
 * @returns {Promise<Note[]>}
 */
async function getNotes(user) {
  const notes = await knex("notes")
    .where("user_id", user)
    .select();

    return notes.map(note => new Note(note) || null);
}

/**
 * @param {String} user
 * @param {String} note
 * @param {Eris.User} author
 * @returns {Promise<void>}
 */
async function addNote(user, note, author) {
  return knex("notes")
    .insert({
      user_id: user,
      note: note,
      created_by_name: `${author.username}#${author.discriminator}`,
      created_by_id: author.id,
      created_at: moment().utc().format("YYYY-MM-DD HH:mm:ss")
    });
}

/**
 * @param {String} user
 * @param {Number} id
 * @returns {Promise<void>}
 */
async function deleteNote(user, id) {
  let notes = await getNotes(user);
  let q = knex("notes")
    .where("user_id", user);
  if (id > 0)
    q = q.where("note", notes[id - 1].note);
  return q.del();
}

/**
 * @param {String} user
 * @param {Number} id
 * @param {String} note
 * @param {Eris.User} author
 * @returns {Promise<Number>}
 */
async function editNote(user, id, note, author) {
  let notes = await getNotes(user);
  return knex("notes")
    .where("user_id", user)
    .where("note", notes[id - 1].note)
    .update({
      note: note,
      created_by_name: `${author.username}#${author.discriminator}`,
      created_by_id: author.id,
      created_at: moment().utc().format("YYYY-MM-DD HH:mm:ss")
    });
}

module.exports = {
  get: getNotes,
  add: addNote,
  edit: editNote,
  del: deleteNote,
};
