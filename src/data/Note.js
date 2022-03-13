const utils = require("../utils/utils");

/**
 * @property {String} user_id
 * @property {String} note
 * @property {String} created_by_id
 * @property {String} created_by_name
 * @property {String} created_at
 * @property {String} thread
 */

class Note {
  constructor(props) {
    utils.setDataModelProps(this, props);
  }
}

module.exports = Note;
