# Modmail for Discord

A bot for [Discord](https://discord.com/) that allows users to DM the bot to contact the server's entire mod team.
These DMs get relayed to a modmail server where each user gets their own channel, or "thread".
Moderators and admins can then reply to these threads, and these responses are relayed back to the original user as a DM.

Inspired by Reddit's modmail system.

## Configuration options

These go in `config.json`. See also `config.example.json`.

|Option|Default|Description|
|------|-------|-----------|
|token|None|**Required!** The bot user's token|
|mailGuildId|None|**Required!** The inbox server's ID|
|mainGuildId|None|**Required!** ID of the main server where people contact the bot from, used for e.g. displaying users' nicknames|
|logChannelId|None|**Required!** Channel where the bot will post log links to closed threads and other alerts|
|errorWebhookId|None|The ID of the webhook which the bot will use to log errors|
|errorWebhookToken|None|The token of the webhook which the bot will use to log errors<br>**Note:** If `errorWebhookId` or `errorWebhookToken` is `null`, errors will be logged to the `logChannelId` channel instead|
|prefix|"!"|Prefix for bot commands|
|snippetPrefix|"!!"|Prefix to use snippets|
|replyAnonDefault|false|If set to true, messages will be sent to the user anonymously by default, without the need for `!ar`|
|snippetAnonDefault|false|If set to true, snippets will be sent to the user anonymously by default, without the need for `!!snippet anon`|
|status|"Message me for help"|The bot's "Playing" text|
|openingMessage|"Hi there, thanks for reaching out to the Dyno modmail bot. This is the best way to get in contact with the Dyno staff team. Please select what you'd like assistance with from the options below so I can route your request to the correct team.<br><br>*Note: We can only offer assistance in English.*"|The bot's response to DMs that start a new thread|
|responseMessage|"Thank you for your message! Our mod team will reply to you here as soon as possible."|The bot's responses to button presses that start a new thread|
|dynoSupportMessage|"We offer Dyno support in the server in the following channels:\n<#240777175802839040> \| English support\n<#335003834445332481> \| In-depth custom command support\n<#395821744696590338> \| Soutien en français\n<#395821762669051904> \| Internationale Unterstützung / Suporte internacional / Apoyo internacional / Uluslararası destek / الدعم الدولي"|The bot's response to whenever the user presses the "Dyno Support" button when attempting to start a new thread|
|newThreadCategoryId|None|ID of the category where new modmail thread channels should be placed|
|adminThreadCategoryId|None|ID of the category where modmail thread channels should be moved when the bot is instructed to move the thread to admins
|mentionRole|"here"|Role that is mentioned when new threads are created or the bot is mentioned. Accepted values are "here", "everyone", or a role id as a string. Set to `null` to disable these pings entirely|
|adminMentionRole|None|Role that is mentioned when a thread is moved to the `adminThreadCategoryId` category|
|inboxServerRoleIDs|None|IDs of required roles a user needs to use bot commands on the inbox server|
|inboxAdminRoleIDs|None|IDs of required roles a user needs to use admin bot commands, or view private threads|
|alwaysReply|false|If set to true, all messages in modmail threads will be relayed back to the user, even ones without `!r`|
|alwaysReplyAnon|false|If `alwaysReply` is set to true, this option controls whether the auto-reply is anonymous|
|useNicknames|false|If set to true, mod replies will use their nickname (on the inbox server) instead of their username|
|ignoreAccidentalThreads|false|If set to true, the bot attempts to ignore common "accidental" messages that would start a new thread, such as "ok", "thanks", etc.|
|threadTimestamps|false|Whether to show custom timestamps in threads, in addition to Discord's own timestamps. Logs always have accurate timestamps, regardless of this setting|
|allowMove|false|If set to true, threads will be allowed to be moved by staff to any category which is inside `allowedCategories`|
|typingProxy|false|If enabled, any time a user is typing to modmail in their DMs, the modmail thread will show the bot as "typing"|
|typingProxyReverse|false|If enabled, any time a moderator is typing in a modmail thread, the user will see the bot "typing" in their DMs|
|allowedCategories|None|IDs of categories that a moderator is allowed to move a thread to|
|autoResponses|None|A set of responses that will be sent when a user sends a message which includes, or starts with, a certain word or phrase|
|enableGreeting|false|Set to true to send a welcome message to new main guild members. Requires `mainGuildId` to be set|
|greetingMessage|None|Text content of the welcome message|
|greetingAttachment|None|Path to an image or other attachment to send along with the greeting|
|relaySmallAttachmentsAsAttachments|false|Whether to relay small (<2MB) attachments from users as attachments rather than links in modmail threads|
|port|8890|Port from which to serve attachments and logs|
|url|None|URL to use for attachment and log links. Defaults to `IP:PORT`|
