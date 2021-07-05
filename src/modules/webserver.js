const Eris = require("eris");
const SSE = require("express-sse");
const express = require("express");
const cookieParser = require("cookie-parser");
const mime = require("mime");
const fs = require("fs");
const https = require("https");
const path = require("path");
const config = require("../config");
const oauth2 = require("../oauth2");
const threads = require("../data/threads");
const attachments = require("../data/attachments");
const knex = require("../knex");

const THREAD_ID = /^[0-9a-f-]+$/;
const ID = /^\d+$/;

/**
 * @param {express.Response} res
 */
function notfound(res) {
  res.status(404);
  res.json({ message: "404: Resource Not Found" });
}

/**
 * @param {String} threadId
 */
async function getLogs (threadId) {
  if (threadId.match(THREAD_ID) === null)
    return;

  const thread = await threads.findById(threadId);
  if (! thread) return;

  return thread.getThreadMessages();
}

/**
 * @param {String} id
 * @param {String} desiredFilename
 */
function getAttachment (id, desiredFilename) {
  if (! ID.test(id))
    return;
  if (desiredFilename.match(/^[0-9a-z._-]+$/i) === null)
    return;

  const attachmentPath = attachments.getPath(id);
  if (! fs.existsSync(attachmentPath))
    return;

  const filenameParts = desiredFilename.split(".");
  const ext = (filenameParts.length > 1 ? filenameParts[filenameParts.length - 1] : "bin");
  return [mime.getType(ext), fs.readFileSync(attachmentPath)];
}

/**
 * @param {Eris.CommandClient} bot
 * @param {SSE} sse
 */
module.exports = (bot, sse) => {
  const app = express();

  app.use(cookieParser());

  app.get("/attachments/:id/:name", async (req, res) => {
    let [mime, attachment] = getAttachment(req.params.id, req.params.name) || [];

    if (! attachment)
      return notfound(res);

    res.set("Content-Type", `${mime}`);
    res.send(attachment);
  });

  if (config.dashAuthRoles || config.dashAuthUsers) {
    app.get(config.redirectPath, oauth2.login);
    app.use(oauth2.checkAuth);
  }

  app.use(express.static(path.join(__dirname, "../dashboard/")));
  app.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    next();
  });

  app.get("/threads", async (req, res) => {
    /**
     * @type {{ [s: string]: any; }}
     */
    let { limit: lim, page, user, sort_by, reverse } = req.query;
    let limit = parseInt(lim) || 50;
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;
    page = parseInt(page) || 0;
    reverse = reverse != null;
    let q = knex("threads");
    if (user)
      q.where("user_id", user);
    else
      q.select("*");
    let total = (await q.clone().count())[0]["count(*)"];
    if (sort_by)
      q.orderBy(sort_by, reverse ? "asc" : "desc");
    q.orderBy("created_at", reverse ? "desc" : "asc");
    let offset = page * limit;
    res.json({
      total: total,
      threads: await q.limit(limit).offset(offset)
    });
  });
  app.get("/threads/:id", async (req, res) => {
    let thread = await knex("threads").where("id", req.params.id).first();
    if (! thread)
      return notfound(res);

    res.json(thread);
  });
  app.get("/users", async (req, res) => {
    let users = await knex("threads").select("user_id", "user_name")
      .groupBy("user_id").orderBy("created_at", "desc");
    res.json(users.map(u => ({ id: u.user_id, name: u.user_name })));
  });
  app.get("/logs/:id", async (req, res) => {
    let logs = await getLogs(req.params.id);
    if (! logs)
      return notfound(res);

    res.json(logs);
  });
  app.get("/avatars/:id", async (req, res) => {
    const user = bot.users.get(req.params.id) || await bot.getRESTUser(req.params.id).catch(
      /** @param {import('eris').DiscordRESTError | import('eris').DiscordHTTPError} e */
      (e) => {
      if (e.code === 404 || e.code === 10013) {
        res.status(400).send("<pre>400 Bad Request</pre>");
      } else {
        process.emit("unhandledRejection", e);
        res.status(500).send(`<pre>500 Server Error: ${e}</pre>`);
      }
      return null;
    });
    if (! user) return;

    res.set("Cache-Control", "max-age=3600").redirect(user.avatarURL);
  });

  app.get("/stream", sse.init);

  if (config.https) {
    const httpsServer = https.createServer({
      key: fs.readFileSync(config.https.privateKey, "utf8"),
      cert: fs.readFileSync(config.https.certificate, "utf8"),
      ca: fs.readFileSync(config.https.ca, "utf8")
    }, app);

    httpsServer.listen(config.port);
  } else {
    app.listen(config.port);
  }
};
