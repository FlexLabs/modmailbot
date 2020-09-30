/**
 * @type {typeof import('../types/datafactory').DataFactory}
 */
const DataFactory = require("@dyno.gg/datafactory");
const config = require("./config");

const dbString = config.mongoDSN;

if (! dbString) {
	throw new Error("Missing environment variable CLIENT_MONGO_URL.");
}

const db = new DataFactory({
	dbString,
});

module.exports = db;
