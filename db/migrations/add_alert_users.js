exports.up = async (knex) => {
  await knex.schema.table("threads", (table) => {
    table.string("alert_users", 20).nullable().defaultTo(null).after("scheduled_close_name");
  });
};

exports.down = async (knex) => {
  await knex.schema.table("threads", table => {
    table.dropColumn("alert_users");
  });
};
