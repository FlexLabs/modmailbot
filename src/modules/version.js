const Eris = require("eris");
const path = require("path");
const fs = require("fs");
const {promisify} = require("util");
const utils = require("../utils/utils");

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);

const GIT_DIR = path.join(__dirname, "..", "..", ".git");

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  bot.registerCommand("version", async (msg) => {
    if (! (await utils.messageIsOnInboxServer(msg))) return;
    if (! utils.isStaff(msg.member)) return;

    const packageJson = require("../../package.json");
    const packageVersion = packageJson.version;

    let response = `Modmail v${packageVersion}`;

    let isGit;
    try {
      await access(GIT_DIR);
      isGit = true;
    } catch (e) {
      isGit = false;
    }

    if (isGit) {
      let commitHash;
      const HEAD = await readFile(path.join(GIT_DIR, "HEAD"), {encoding: "utf8"});

      if (HEAD.startsWith("ref:")) {
        // Branch
        const ref = HEAD.match(/^ref: (.*)$/m)[1];
        commitHash = (await readFile(path.join(GIT_DIR, ref), {encoding: "utf8"})).trim();
      } else {
        // Detached head
        commitHash = HEAD.trim();
      }

      response += ` (${commitHash.slice(0, 7)})`;
    }

    bot.createMessage(msg.channel.id, response);
  });
};
