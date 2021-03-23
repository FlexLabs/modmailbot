const Eris = require("eris");

const childProcess = require("child_process");

const GIT_VALIDATOR = /^git[\w\d\s-"'/.]+$/;

/**
 * @param {String} command
 * @param {childProcess.ExecOptions} [options]
 */
async function exec(command, options) { // My very elaborate asynchronous streamed execution function, you're welcome
  return new Promise((res, rej) => {
    let output = "";
    /**
     * @param {Buffer|String} data
     */
    const writeFunction = (data) => {
      output += `${data}`; // Buffer.toString()
    };

    const cmd = childProcess.exec(command, options);
    cmd.stdout.on("data", writeFunction);
    cmd.stderr.on("data", writeFunction);
    cmd.on("error", writeFunction);
    cmd.once("close", (code) => {
      cmd.stdout.off("data", writeFunction);
      cmd.stderr.off("data", writeFunction);
      cmd.off("error", writeFunction);
      setTimeout(() => {}, 1000);
      if (code !== 0) rej(new Error(`Command failed: ${command}\n${output}`));
      res(output);
    });
  });
}

/**
 * @param {Eris.CommandClient} bot
 */
module.exports = bot => {
  bot.registerCommand("git", async (msg, args) => {
    const command = `git ${args.join(" ")}`;
    if (! GIT_VALIDATOR.test(command)) return msg.channel.createMessage("no.");

    const message = await msg.channel.createMessage("Running...");
    exec(command).then(
      (res) => message.edit(`\`\`\`\n${res}\n\`\`\``),
      (rej) => message.edit(`\`\`\`\n${rej.message}\n\`\`\``)
    );
  }, {
    requirements: {
      custom: (msg) => msg.member.roles.some((r) => ["203040224597508096", "523021576128692239"].includes(r))
    }
  });
};