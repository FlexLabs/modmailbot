const superagent = require("superagent");
const jwt = require("jsonwebtoken");
const config = require("./config");
const bot = require("./bot");
const utils = require("./utils/utils");

function login (req, res) {
  utils.getSelfUrl(config.redirectPath.slice(1)).then(redirectUri => {
    let code = req.query.code;
    const oauth2url = `https://discord.com/oauth2/authorize?client_id=${config.clientId}`
      + `&scope=identify&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
    if (! code)
      return res.redirect(oauth2url);
    superagent.post("https://discord.com/api/oauth2/token")
      .type("form")
      .send({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        scope: "identify"
      }).then(response => {
        let token = jwt.sign({
          token: response.body.access_token
        }, config.clientSecret);
        res.cookie("token", token, {
          maxAge: response.body.expires_in * 1000
        });
        res.redirect("/");
      }).catch(() => {
        res.status(401);
        res.send("<pre>401 Unauthorized</pre>");
      });
  });
}

function isDashAdmin (user) {
  try {
    const guild = bot.guilds.get(config.mainGuildId);
    const member = guild.members.get(user.id);
    return utils.isAdmin(member);
  } catch (err) {
    return false;
  }
}

async function getAuthUser (token) {
  let user;

  try {
    let accessToken = jwt.verify(token, config.clientSecret).token;
    let response = await superagent.get("https://discord.com/api/users/@me")
      .set("Authorization", `Bearer ${accessToken}`);

    user = response.body;
  } catch (err) {
    return;
  }

  return user;
}

async function checkAuth (req, res, next) {
  if (req.cookies.token) {
    req.user = await getAuthUser(req.cookies.token);

    if (! req.user) {
      return res.redirect("/login");
    } else {
      const guild = bot.guilds.get(config.mailGuildId);
      const member = guild && guild.members.get(req.user.id);

      if (member) {
        let isAuthorized;

        if (config.dashAuthRoles)
          isAuthorized = member.roles.some(r => config.dashAuthRoles.includes(r));
        if (config.dashAuthUsers)
          isAuthorized = config.dashAuthUsers.includes(member.id);

        if (isAuthorized) {
          return next();
        }
      }

      res.status(401);
      res.send("<pre>401 Unauthorized</pre>");
    }
  } else {
    res.redirect("/login");
  }
}

module.exports = {
  login,
  isDashAdmin,
  getAuthUser,
  checkAuth,
};
